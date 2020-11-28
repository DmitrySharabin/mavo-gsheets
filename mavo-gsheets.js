// @ts-check

/**
 * Google Sheets backend plugin for Mavo
 * @author Dmitry Sharabin and contributors
 * @version %%VERSION%%
 */

(($) => {
	"use strict";

	Mavo.Plugins.register("gsheets", {});

	const _ = Mavo.Backend.register($.Class({
		extends: Mavo.Backend,

		id: "GoogleSheets",

		constructor(url, { mavo, format }) {
			this.permissions.on(["read", "edit", "add", "delete", "save"]);

			/**
			 * @namespace
			 * @property {string} apiKey — The API key. It's safe for embedding in URLs; it doesn't need any encoding.
			 * @property {string} spreadsheet — The value between the "/d/" and the "/edit" in the URL of a spreadsheet.
			 * @property {string} sheet — The title of the sheet with data. "Sheet1" by default.
			 * @property {string} range — A range with data in A1 notation. If not specified, supposed all the cells in the sheet.
			 * @property {string} dimension — Indicates how data is organized on the specified sheet: in `rows` (by default) or `columns`.
			 * @property {string} render — Determines whether values should be displayed according to the cell's formatting on the sheet (`formatted_values`) or not (`unformatted_values`).
			 * @property (boolean) idify — If true, convert headers to something that looks like the ids so that they could be used as property names.
			 */
			const config = {
				apiKey: mavo.element.getAttribute("mv-gs-key"),
				spreadsheet: this.url.pathname.slice(1).split("/")[2] || "",
				sheet: mavo.element.getAttribute("mv-gs-sheet") || "Sheet1",
				range: mavo.element.getAttribute("mv-gs-range") || "",
				dimension: mavo.element.getAttribute("mv-gs-data-in") || "rows",
				render: `${mavo.element.getAttribute("mv-gs-values") || "unformatted"}_value`,
				idify: mavo.element.hasAttribute("mv-gs-idify-headers")
			};

			$.extend(this, config);

			this.apiURL = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheet}/values/'${this.sheet}'${this.range ? `!${this.range}` : ""}`);
			this.apiURL.searchParams.set("key", this.apiKey);
		},

		/**
		 * Low-level function for reading data.
		 *
		 * Mavo.Backend#get() adds the timestamp parameter, and the request to the server returns 400;
		 * that's why we need to implement this method.
		 */
		async get() {
			const url = this.apiURL;
			url.searchParams.set("valueRenderOption", this.render);
			url.searchParams.set("majorDimension", this.dimension);

			try {
				const response = await fetch(url.href);
				const json = await response.json();
				const values = json.values;

				const [headers, ...data] = values;

				const properties = [];
				for (let header of headers) {
					if (this.idify) {
						// Fix headers so we can use them as property names.
						header = Mavo.Functions.idify(header);
					}

					properties.push(header);
				}

				const ret = [];

				for (const piece of data) {
					ret.push(_.zipObject(properties, piece));
				}

				const property = this.mavo.root.getNames("Collection")[0] || "content";

				return { [property]: ret };
			}
			catch (e) {
				return null;
			}
		},

		/**
		 * Low-level saving code.
		 * @param {string} serialized Data serialized according to this.format.
		 * @param {string} path Path to store data.
		 * @param {object} o Arbitrary options.
		 */
		async put(serialized, path = this.path, o = {}) {
			const data = JSON.parse(serialized);

			const property = this.mavo.root.getNames("Collection")[0] || "content";

			const [headers, ...values] = data[property];

			const ret = [Object.keys(headers)];
			for (const val of values) {
				ret.push(Object.values(val));
			}

			try {
				const url = this.apiURL;

				// TODO: Add authentication.
				await fetch(url.href, {
					method: "PUT",
					body:
					{
						range: this.range,
						majorDimension: this.dimension,
						values: ret
					}
				});
			} catch (e) {
				return null;
			}
		},

		static: {
			/**
			 * Determines whether the Google Sheets backend is used.
			 * @param {string} value The mv-storage/mv-source/mv-init value.
			 */
			test: function (value) {
				return /^https:\/\/docs.google.com\/spreadsheets\/.+/.test(value);
			},

			/**
			 * Pairing elements in two arrays into a JavaScript object by key and value.
			 * @param {array} props Array of keys.
			 * @param {array} values Array of values.
			 *
			 * @example
			 * // returns { a: 1, b: 2, c: 3 }
			 * zipObject(["a", "b", "c"], [1, 2, 3]);
			 *
			 * @see {@link https://lowrey.me/lodash-zipobject-in-es6-javascript/}
			 */
			zipObject: function (props, values) {
				return props.reduce((prev, prop, i) => {
					return Object.assign(prev, { [prop]: values[i] });
				}, {});
			}
		}
	}));
})(Bliss)
