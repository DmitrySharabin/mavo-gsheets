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

		constructor() {
			this.permissions.on(["read", "edit", "add", "delete", "save"]);

			// Since we need an access token to write data back to a spreadsheet,
			// let's check whether we already have one.
			this.oAuthenticate(true);
		},

		update(url, o) {
			this.super.update.call(this, url, o);

			/**
			 * @property {string} apikey — The API key for unauthenticated GET requests. It's safe for embedding in URLs; it doesn't need any encoding.
			 * @property {string} spreadsheet — A spreadsheet id. The value between the "/d/" and the "/edit" in the URL of a spreadsheet.
			 * @property {string} sheet — The title of the sheet with data. If not provided, the first visible sheet will be used by default.
			 * @property {string} range — A range with data in A1 notation. If not specified, supposed all the cells in the sheet.
			 */
			this.apikey = o.apikey ?? "AIzaSyCiAkSCE96adO_mFItVdS9fi7CXfTiwhe4";
			this.spreadsheet = o.spreadsheet ?? this.url.pathname.slice(1).split("/")[2];
			this.sheet = o.sheet;
			this.range = o.range;

			/**
			 * Supported backend-specific options:
			 *
			 * formattedValues — Determines whether values should be displayed according to the cell's formatting on the sheet (if true) or not (if false).
			 * dataInColumns — If true, indicates that data is organized on the specified sheet in columns.
			 * transformHeaders — If true, convert headers to something that looks like the ids so that they could be used as property names.
			 */
			if (o.options) {
				Object.assign(this, Mavo.options(o.options));
			}

			/**
			 * Since sheet title and cells range are optional, we need to cover all the possible cases:
			 *
			 * - 'Sheet title'!Range
			 * – 'Sheet title'
			 * – Range
			 */
			this.sheetAndRange = `${this.sheet ? `'${this.sheet}'` : ""}${this.range ? (this.sheet ? `!${this.range}` : this.range) : ""}`

			this.apiURL = new URL(`${_.apiDomain}/${this.spreadsheet}/values/${this.sheetAndRange}`);
			this.apiURL.searchParams.set("key", this.apikey);
		},

		/**
		 * Low-level function for reading data.
		 *
		 * Mavo.Backend#get() adds the timestamp parameter, and the request to the server returns 400;
		 * that's why we need to implement this method.
		 */
		async get() {
			if (this.sheetAndRange === "") {
				await this.findSheet();
			}

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

				if (headers.some(h => !h.trim().length)) {
					// Not all data has headers. Warn an author.
					Mavo.warn(this.mavo._("mv-gsheets-empty-cells-in-headers"));

					// What if there are more than one data set and an author didn't provide a data range?
					// Let them know about that.
					if (!this.range) {
						Mavo.warn(this.mavo._("mv-gsheets-range-not-provided"));
					}
				}

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
				if (this.sheetAndRange === "") {
					await this.findSheet();
				}

				const url = new URL(this.apiURL);
				url.searchParams.set("valueInputOption", "RAW");

				if (!this.isAuthenticated()) {
					await this.oAuthenticate();
				}

				const body = {
					"range": this.sheetAndRange,
					"majorDimension": this.dataInColumns ? "COLUMNS" : "ROWS",
					"values": data
				};

				return this.request(url, body, "PUT").catch(async e => {
					if (e.status === 401) {
						// If the OAuth access token has expired, remove it, re-authenticate a user, and repeat the request.
						this.accessToken = null;
						await this.oAuthenticate();

						return this.request(url, body, "PUT");
					}
				});
			} catch (e) {
				return null;
			}
		},

		/**
		 * If neither sheet title nor range is provided, we should use some default range to get/read data from/to.
		 * Otherwise, a request to a spreadsheet will fail, and we don't want it.
		 * Let's use all cells of the first visible sheet by default. To do that, we need to provide its title.
		 */
		async findSheet() {
			const url = new URL(`${_.apiDomain}/${this.spreadsheet}`);
			url.searchParams.set("key", this.apikey);

			const response = await fetch(url.href);
			const spreadsheet = await response.json();

			const visibleSheet = spreadsheet.sheets.find(sheet => !sheet.properties.hidden);

			// Wrap the sheet title into single quotes since it might have spaces in it.
			this.sheetAndRange = `'${visibleSheet.properties.title}'`;

			// Rebuild apiURL using the new range.
			this.apiURL = new URL(`${_.apiDomain}/${this.spreadsheet}/values/${this.sheetAndRange}`);
			this.apiURL.searchParams.set("key", this.apikey);
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
				return /^https:\/\/docs.google.com\/spreadsheets\/?.*/.test(value);
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
					// Skip empty property names (and corresponding data) since they are useless.
					if (!prop.trim().length) {
						return prev;
					}

					return Object.assign(prev, { [prop]: values[i] });
				}, {});
			}
		}
	}));

	Mavo.Locale.register("en", {
		"mv-gsheets-range-not-provided": "If there is more than one table with data on a sheet, you should provide a range with the needed data. For more information, see the plugin docs.",
		"mv-gsheets-empty-cells-in-headers": "It looks like not all your data has headers. Please, make sure that the row/column with headers hasn't got empty cells."
	});
})(Bliss)
