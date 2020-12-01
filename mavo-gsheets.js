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
			this.sheetAndRange = `${this.sheet ? `'${this.sheet}'` : ""}${this.range ? (this.sheet ? `!${this.range}` : this.range) : ""}`

			this.apiURL = new URL(`${_.apiDomain}/${this.spreadsheet}/values/${this.sheetAndRange}`);
			this.apiURL.searchParams.set("key", this.apiKey);

			// Since we need an access token to write data back to a spreadsheet,
			// let's check whether we already have one.
			this.oAuthenticate(true);
		},

		/**
		 * Low-level function for reading data.
		 *
		 * Mavo.Backend#get() adds the timestamp parameter, and the request to the server returns 400;
		 * that's why we need to implement this method.
		 */
		async get() {
			const url = new URL(this.apiURL);

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
				if (this.transformHeaders) {
					headers = headers.map(header => Mavo.Functions.idify(header));
				}

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
			// WARNING! If app has more than one collection, this code fails.
			let data = JSON.parse(serialized);

			// Transform data so that Google Sheets API could handle it.
			const headers = Object.keys(data[0]);

			data = data.map(d => Object.values(d));
			data = [headers, ...data];

			try {
				const url = new URL(this.apiURL);
				url.searchParams.set("valueInputOption", "RAW");

				if (!this.isAuthenticated()) {
					await this.oAuthenticate();
				}

				return this.request(url, {
					"range": this.sheetAndRange,
					"majorDimension": this.dataInColumns ? "COLUMNS" : "ROWS",
					"values": data
				}, "PUT");
			} catch (e) {
				return null;
			}
		},

		oAuthParams: () => "&redirect_uri=https://auth.mavo.io&response_type=code&scope=https://www.googleapis.com/auth/spreadsheets",

		static: {
			apiDomain: "https://sheets.googleapis.com/v4/spreadsheets",
			oAuth: "https://accounts.google.com/o/oauth2/auth",
			key: "380712995757-4e9augrln1ck0soj8qgou0b4tnr30o42.apps.googleusercontent.com", // Client ID for PUT requests

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
