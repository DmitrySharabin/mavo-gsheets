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

		id: "GSheets",

		constructor(url, { mavo, format }) {
			this.permissions.on(["read", "edit", "add", "delete", "save"]);

			/**
			 * @property {string} apiKey — The API key for unauthenticated GET requests. It's safe for embedding in URLs; it doesn't need any encoding.
			 * @property {string} spreadsheet — The value between the "/d/" and the "/edit" in the URL of a spreadsheet.
			 * @property {string} sheet — The title of the sheet with data. If not provided, the first visible sheet will be used by default.
			 * @property {string} range — A range with data in A1 notation. If not specified, supposed all the cells in the sheet.
			 */
			const config = {
				apiKey: mavo.element.getAttribute("mv-gsheets-key") ?? "AIzaSyCiAkSCE96adO_mFItVdS9fi7CXfTiwhe4",
				spreadsheet: this.url.pathname.slice(1).split("/")[2],
				sheet: mavo.element.getAttribute("mv-gsheets-sheet"),
				range: mavo.element.getAttribute("mv-gsheets-range")
			};

			/**
			 * Supported options
			 *
			 * formattedValues — Determines whether values should be displayed according to the cell's formatting on the sheet (if true) or not (if false).
			 * dataInColumns — If true, indicates that data is organized on the specified sheet in columns.
			 * transformHeaders — If true, convert headers to something that looks like the ids so that they could be used as property names.
			 */
			const options = mavo.element.getAttribute("mv-gsheets-options");

			if (options) {
				Object.assign(config, Mavo.options(options));
			}

			$.extend(this, config);

			/**
			 * Since sheet title and cells range are optional, we need to cover all the possible cases:
			 *
			 * - 'Sheet title'!Range
			 * – 'Sheet title'
			 * – Range
			 */
			const sheetAndRange = `${this.sheet ? `'${this.sheet}'` : ""}${this.range ? (this.sheet ? `!${this.range}` : this.range) : ""}`

			this.apiURL = new URL(`${_.apiDomain}/${this.spreadsheet}/values/${sheetAndRange}`);
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

			if (this.dataInColumns) {
				url.searchParams.set("majorDimension", "columns");
			}

			if (this.formattedValues) {
				url.searchParams.set("valueRenderOption", "formatted_value");
			} else {
				url.searchParams.set("valueRenderOption", "unformatted_value");
			}

			try {
				const response = await fetch(url.href);
				const json = await response.json();
				const values = json.values;

				let [headers, ...data] = values;

				// If needed, fix headers so we can use them as property names.
				headers = headers.map(header => this.transformHeaders ? Mavo.Functions.idify(header) : header);

				// Assign data to corresponding properties.
				data = data.map(d => _.zipObject(headers, d));

				return data;
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
			apiDomain: "https://sheets.googleapis.com/v4/spreadsheets",
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
