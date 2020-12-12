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
			this.permissions.on(["read", "edit", "add", "delete", "login"]);

			// Since we need an access token to write data back to a spreadsheet,
			// let's check whether we already have one.
			this.login(true);
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
			 * transformHeadings — If true, convert headings to something that looks like the ids so that they could be used as property names.
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

			this.apiURL = _.buildURL(`${this.spreadsheet}/values/${this.sheetAndRange}`, { key: this.apikey });
		},

		/**
		 * Low-level function for reading data.
		 *
		 * Mavo.Backend#get() adds the timestamp parameter, and the request to the server returns 400;
		 * that's why we need to implement this method.
		 */
		async get() {
			try {
				if (this.sheetAndRange === "") {
					await this.findSheet();
				}
			} catch (e) {
				if (e.status === 403) {
					// If a user doesn't have permissions to read data from a spreadsheet, tell them about it.
					Mavo.warn(this.mavo._("mv-gsheets-read-permission-denied"));
				}
				else {
					Mavo.warn(e);
				}

				return null;
			}

			const url = _.buildURL(this.apiURL, {
				"majorDimension": this.dataInColumns ? "columns" : "rows",
				"valueRenderOption": this.formattedValues ? "formatted_value" : "unformatted_value"
			});

			// Prefer an unauthenticated request. If it fails, try the authenticated one.
			let response = await fetch(url.href);

			if (!response.ok && this.isAuthenticated()) {
				response = await fetch(url.href, {
					headers: {
						Authorization: `Bearer ${this.accessToken}`
					},
				});
			}

			// The request failed? It doesn't make sense to proceed.
			if (!response.ok) {
				if (response.status === 403) {
					// If a user doesn't have permissions to read data from a spreadsheet, tell them about it.
					Mavo.warn(this.mavo._("mv-gsheets-read-permission-denied"));
				}

				return null;
			}

			const json = await response.json();
			const values = json.values;

			let [headings, ...data] = values ?? [[], []];

			if (headings.some(h => !h.trim().length)) {
				// Not all data has headings. Warn an author.
				Mavo.warn(this.mavo._("mv-gsheets-empty-cells-in-headings"));

				// What if there are more than one data set and an author didn't provide a data range?
				// Let them know about that.
				if (!this.range) {
					Mavo.warn(this.mavo._("mv-gsheets-range-not-provided"));
				}
			}

			// If needed, fix headings so we can use them as property names.
			if (this.transformHeadings) {
				headings = headings.map(heading => Mavo.Functions.idify(heading));
			}

			// Assign data to corresponding properties.
			data = data.map(d => _.zipObject(headings, d));

			return data;
		},

		/**
		 * High level function for storing data.
		 */
		async store(data) {
			// Get the name of the first property that is a collection without mv-value.
			const collection = this.mavo.root.getNames((_, n) => {
				return n instanceof Mavo.Collection && !n.expressions?.[0]?.isDynamicObject;
			})[0];

			// If there is no such collection, try to use the data provided by Mavo.
			// This will let us store a set of simple properties and make the plugin more universal.
			data = this.mavo.root.children?.[collection]?.getData() ?? data;

			if (data?.length) {
				// If there is data, transform it so that Google Sheets API could handle it.
				const headings = Object.keys(data[0]);

				data = data.map(d => Object.values(d));
				data = [headings, ...data];
			}

			try {
				if (this.sheetAndRange === "") {
					await this.findSheet();
				}

				// Clear the existing data before writing the new one.
				let url = _.buildURL(`${this.spreadsheet}/values/${this.sheetAndRange}:clear`, { key: this.apikey });
				await this.request(url, null, "POST");

				// Write the new data.
				url = _.buildURL(this.apiURL, { "valueInputOption": "raw" });
				const body = {
					"range": this.sheetAndRange,
					"majorDimension": this.dataInColumns ? "columns" : "rows",
					"values": data
				};

				const res = await this.request(url, body, "PUT");

				return res;
			} catch (e) {
				if (e.status === 403) {
					// If a user doesn't have permissions to write to a spreadsheet, tell them about it.
					this.mavo.error(this.mavo._("mv-gsheets-write-permission-denied"));
				}
				else {
					Mavo.warn(e);
				}

				return null;
			}
		},

		async login(passive) {
			try {
				await this.oAuthenticate(passive);
				await this.getUser();

				if (this.user) {
					this.permissions.on(["save", "logout"]);
				}
			} catch (e) {
				if (e.status === 401) {
					// Unauthorized. Access token we have is invalid, discard it.
					this.logout();
				}
			}
		},

		async logout() {
			await this.oAuthLogout();

			this.user = null;
			this.permissions.on(["edit", "add", "delete"]);
		},

		async getUser() {
			if (this.user) {
				return this.user;
			}

			const info = await this.request("https://www.googleapis.com/oauth2/v2/userinfo");

			this.user = {
				name: info.name,
				avatar: info.picture,
				info
			};

			$.fire(this.mavo.element, "mv-login", { backend: this });
		},

		/**
		 * If neither sheet title nor range is provided, we should use some default range to get/read data from/to.
		 * Otherwise, a request to a spreadsheet will fail, and we don't want it.
		 * Let's use all cells of the first visible sheet by default. To do that, we need to provide its title.
		 */
		async findSheet() {
			const url = _.buildURL(this.spreadsheet, { key: this.apikey });

			// Prefer an unauthenticated request. If it fails, try the authenticated one.
			let response = await fetch(url.href);

			if (!response.ok && this.isAuthenticated()) {
				response = await fetch(url.href, {
					headers: {
						Authorization: `Bearer ${this.accessToken}`
					},
				});
			}

			// The request failed? It doesn't make sense to proceed.
			if (!response.ok) {
				return Promise.reject(response);
			}

			const spreadsheet = await response.json();

			const visibleSheet = spreadsheet?.sheets?.find(sheet => !sheet.properties.hidden);

			// Wrap the sheet title into single quotes since it might have spaces in it.
			this.sheetAndRange = `'${visibleSheet?.properties?.title}'`;

			// Rebuild apiURL using the new range.
			this.apiURL = _.buildURL(`${this.spreadsheet}/values/${this.sheetAndRange}`, { key: this.apikey });
		},

		oAuthParams: () => `&redirect_uri=${encodeURIComponent("https://auth.mavo.io")}&response_type=code&scope=${encodeURIComponent(_.scopes.join(" "))}`,

		static: {
			apiDomain: "https://sheets.googleapis.com/v4/spreadsheets/",
			oAuth: "https://accounts.google.com/o/oauth2/auth",
			scopes: [
				"https://www.googleapis.com/auth/spreadsheets",
				"https://www.googleapis.com/auth/userinfo.profile"
			],
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
			},

			/**
			 * Returns a newly created URL object with provided as an argument query parameters.
			 * @param {string} url Relative URL.
			 * @param {object} params Query parameters.
			 */
			buildURL(url, params = {}) {
				const ret = new URL(url, _.apiDomain);

				for (const p in params) {
					ret.searchParams.set(p, params[p]);
				}

				return ret;
			}
		}
	}));

	Mavo.Locale.register("en", {
		"mv-gsheets-range-not-provided": "If there is more than one table with data on a sheet, you should provide a range with the needed data. For more information, see the plugin docs.",
		"mv-gsheets-empty-cells-in-headings": "It looks like not all your data has headings. Please, make sure that the row/column with headings hasn't got empty cells.",
		"mv-gsheets-write-permission-denied": "You don't have permission to save data to the spreadsheet.",
		"mv-gsheets-read-permission-denied": "You don't have permission to read data from the spreadsheet."
	});
})(Bliss)
