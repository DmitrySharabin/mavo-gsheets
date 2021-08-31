// @ts-check

/**
 * Google Sheets backend plugin for Mavo
 * @author Dmitry Sharabin and contributors
 * @version 1.0.1
 */

(($, $f) => {
	"use strict";

	const UNIX_EPOCH_OFFSET = 25569;

	Mavo.Plugins.register("gsheets", {
		hooks: {
			"node-getdata-end": function (env) {
				if (this instanceof Mavo.Primitive && this.dateType) {
					// Convert dates to serial numbers.

					if (!env.data.includes("-")) {
						// We have only time, so we need to add it to the current date.
						env.data = `${new Date().toISOString().split("T")[0]}T${env.data}`
					}

					let timezoneOffset = env.data.includes("T") ? $f.localTimezone * $f.minutes() : 0;
					const date = new Date(env.data);

					env.data = UNIX_EPOCH_OFFSET + (date.getTime() + timezoneOffset) / $f.days();
				}
			}
		}
	});

	const _ = Mavo.Backend.register(class GSheets extends Mavo.Backend {
		id = "Google Sheets"

		constructor (url, o) {
			super(url, o);

			this.permissions.on(["read", "edit", "add", "delete", "login"]);

			// Since we need an access token to write data back to a spreadsheet,
			// let's check whether we already have one.
			this.login(true);
		}

		update (url, o) {
			super.update(url, o);

			/**
			 * @property {string} apikey — The API key for unauthenticated GET requests. It's safe for embedding in URLs; it doesn't need any encoding.
			 * @property {string} spreadsheet — A spreadsheet id. The value between the "/d/" and the "/edit" in the URL of a spreadsheet.
			 * @property {string} sheet — The title of the sheet with data. If not provided, the first visible sheet will be used by default.
			 * @property {string} range — A range with data in A1 notation. If not specified, supposed all the cells in the sheet.
			 */
			this.apikey = o.apikey ?? "AIzaSyCiAkSCE96adO_mFItVdS9fi7CXfTiwhe4";
			this.spreadsheet = o.spreadsheet ?? this.url.pathname?.slice(1)?.split("/")[2];
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
		}

		// Define computed properties
		get sheetAndRange () {
			/**
			 * Since sheet title and cells range are optional, we need to cover all the possible cases:
			 *
			 * - 'Sheet title'!Range
			 * – 'Sheet title'
			 * – Range
			 */
			return `${this.sheet ? `'${this.sheet}'` : ""}${this.range ? (this.sheet ? `!${this.range}` : this.range) : ""}`
		}

		get apiURL () {
			return _.buildURL(`${this.spreadsheet}/values/${this.sheetAndRange}`, { key: this.apikey });
		}

		/**
		 * Low-level function for reading data.
		 */
		async get () {
			try {
				if (this.sheetAndRange === "") {
					await this.findSheet();
				}
			} catch (e) {
				switch (e.status) {
					case 403:
						// No read permissions
						this.mavo.error(this.mavo._("mv-gsheets-read-permission-denied"));
						break;
					case 404:
						// No spreadsheet
						this.mavo.error(this.mavo._("mv-gsheets-spreadsheet-not-found"));
						break;
					default:
						Mavo.warn(e.message || e.response?.error?.message);
				}

				return null;
			}

			const url = _.buildURL(this.spreadsheet, { key: this.apikey, ranges: [this.sheetAndRange], includeGridData: true });;

			let response;
			if (this.isAuthenticated()) {
				response = await fetch(url.href, {
					headers: {
						Authorization: `Bearer ${this.accessToken}`
					},
				});

				if (response.status === 401) {
					// Access token we have is invalid, discard it.
					// But we can still try an unauthenticated request.
					await this.logout();
				}
			}

			if (!this.isAuthenticated()) {
				response = await fetch(url.href);
			}

			// The request failed? It doesn't make sense to proceed.
			if (!response.ok) {
				const error = (await response.json()).error.message;

				switch (response.status) {
					case 400:
						// Invalid sheet name and/or data range
						Mavo.warn(this.mavo._("mv-gsheets-no-sheet-or-invalid-range"));
						break;
					case 403:
						// No read permissions
						this.mavo.error(this.mavo._("mv-gsheets-read-permission-denied"));
						break;
					case 404:
						// No spreadsheet
						this.mavo.error(this.mavo._("mv-gsheets-spreadsheet-not-found"));
						break;
				}

				Mavo.warn(error);

				return null;
			}

			let rawValues = (await response.json()).sheets[0].data[0].rowData.map(r => r.values);
			if (this.dataInColumns) {
				// Transpose the array with data (https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript)
				rawValues = rawValues[0].map((_, colIndex) => rawValues.map(row => row[colIndex]));
			}

			const reversed = [...rawValues[0]].reverse();

			// Range of indices of columns with data
			const start = rawValues[0].findIndex(el => el?.effectiveValue);
			const end = reversed.length - reversed.findIndex(el => el?.effectiveValue) - 1;

			if (start === -1) {
				// There is no data to work with
				return null;
			}

			const values = [];
			for (let rowIndex = 0; rowIndex < rawValues.length; rowIndex++) {
				const row = rawValues[rowIndex];
				let emptyCellsCount = 0;

				const ret = [];

				for (let colIndex = start; colIndex <= end; colIndex++) {
					const cell = row[colIndex];
					let value;

					if (!cell?.effectiveValue) {
						// We have an empty cell
						emptyCellsCount += 1;
						ret.push(undefined);
						continue;
					}

					if (this.formattedValues) {
						value = cell.formattedValue;
					}
					else {
						value = cell.effectiveValue["stringValue"] ?? cell.effectiveValue["numberValue"] ?? cell.effectiveValue["boolValue"];

						// Do we have date/time/date and time?
						if (cell.effectiveFormat.numberFormat) {
							const type = cell.effectiveFormat.numberFormat.type;

							if (["DATE", "TIME", "DATE_TIME"].includes(type)) {
								// Convert serial number to ms.
								const timezoneOffset = $f.localTimezone * $f.minutes();
								const date = $f.date((value - UNIX_EPOCH_OFFSET) * $f.days());
								const time = $f.time((value - Math.trunc(value)) * $f.days() - timezoneOffset, "seconds");

								switch (type) {
									case "DATE":
										value = date;
										break;

									case "TIME":
										value = time;
										break;

									case "DATE_TIME":
										value = `${date}T${time}`;
										break;
								}
							}
						}
					}

					ret.push(value);
				}

				if (emptyCellsCount === end - start + 1) {
					// Skip rows of empty cells
					continue;
				}

				values.push(ret);
			}

			// We need to store the loaded data so that we can perform diff later.
			// Why? Because Google Sheets has a built-in version history and we want to benefit from it.
			// And if every time we overwrite the full data range, it makes the version history useless.
			this.loadedData = values;

			let [headings, ...data] = values;
			this.recordCount = data.length;

			if (headings.some(h => !h || !h.trim?.()?.length)) {
				// Not all data has headings. Warn an author.
				Mavo.warn(this.mavo._("mv-gsheets-empty-cells-in-headings"));

				// What if there are more than one data set and an author didn't provide a data range?
				// Let them know about that.
				if (!this.range) {
					Mavo.warn(this.mavo._("mv-gsheets-range-not-provided"));
				}
			}

			if (this.transformHeadings) {
				this.rawHeadings = headings;

				// Fix headings so we can use them as property names.
				// To let them be used in expressions, we also must replace dashes with underscores.
				headings = headings.map(heading => $f.idify(heading).replace(/\-/g, "_"));
			}

			// Assign data to corresponding properties.
			if (headings.length === 1) {
				// We have a collection of primitives
				data = { [headings[0]]: data.flat() };
			}
			else {
				// We have a collection of groups
				data = data.map(d => _.zipObject(headings, d));
			}

			return data;
		}

		/**
		 * High level function for storing data.
		 */
		async store (data) {
			// Get the name of the first property that is a collection without mv-value.
			const collection = this.mavo.root.getNames((_, n) => {
				return (n instanceof Mavo.Collection || n instanceof Mavo.ImplicitCollection) && !n.expressions?.[0]?.isDynamicObject;
			})[0];

			data = this.mavo.root.children[collection]?.getData() ?? data;

			if (!collection) {
				// If there is no collection, try to use the data provided by Mavo.
				// We might have a set of simple properties.

				// Transform data so that Google Sheets API could handle it.
				if (data.length) {
					data = data[0];
				}

				data = [Object.keys(data), Object.values(data)];
			}
			else {
				// There is a collection to work with
				if (data.length) {
					// If there is data, transform it so that Google Sheets API could handle it.
					let headings = Object.keys(this.mavo.root.children[collection].children[0].children ?? {});

					if (headings.length > 1) {
						// We have a complex collection
						data = data.map(d => Object.values(d));
					}
					else {
						// We have a simple collection
						headings = [collection];
						data = data.map(d => $.type(d) === "object" ? Object.values(d) : [d]);
					}

					data = [headings, ...data];
				}
				else if (this.loadedData?.length) {
					// If there is no data to store, but previously we had one,
					// we must delete them in the spreadsheet.
					// To do that, we need to give the plugin a hint and it will do the rest.
					data = [Array(this.loadedData[0].length).fill("")]; // [ ["", ..., ""] ]
				}
				else {
					// No data to store, no need to proceed.
					return true;
				}
			}

			if (!data[0].length) {
				// No data to store, no need to proceed.
				return true;
			}

			// We mustn't violate user-entered headings while saving data
			if (this.transformHeadings && this.rawHeadings) {
				data[0] = this.rawHeadings;
			}

			if (this.sheetAndRange === "") {
				try {
					await this.findSheet({ isStoring: true });
				} catch (e) {
					switch (e.status) {
						case 401:
							// Unauthorized
							this.mavo.error(this.mavo._("mv-gsheets-login-to-proceed"));
							break;
						case 403:
							// No write permissions
							this.mavo.error(this.mavo._("mv-gsheets-write-permission-denied"));
							break;
						case 404:
							// No spreadsheet
							this.mavo.error(this.mavo._("mv-gsheets-spreadsheet-not-found"));
							break;
						default:
							Mavo.warn(e.message || e.response?.error?.message);
					}

					return true;
				}
			}

			const recordCount = data.length - 1;

			// If we write back fewer records than we previously got, we need to remove the old data.
			// The way we can do it is to provide records filled with empty strings.
			if (recordCount < this.recordCount) {
				const record = Array(data[0].length).fill(""); // ["", ..., ""] — empty row/column of data
				const records = Array(this.recordCount - recordCount).fill(record); // [ ["", ..., ""], ["", ..., ""], ..., ["", ..., ""] ]

				data = data.concat(records);
			}

			// Write the new data.
			const url = _.buildURL(this.apiURL, {
				"valueInputOption": "user_entered",
				"responseValueRenderOption": this.formattedValues ? "formatted_value" : "unformatted_value",
				"includeValuesInResponse": true
			});
			const body = {
				"range": this.sheetAndRange,
				"majorDimension": this.dataInColumns ? "columns" : "rows",
				"values": data
			};

			let res;
			try {
				res = await this.request(url, body, "PUT");
			} catch (e) {
				switch (e.status) {
					case 401:
						// Unauthorized
						this.mavo.error(this.mavo._("mv-gsheets-login-to-proceed"));
						return true;
					case 403:
						// No write permissions
						this.mavo.error(this.mavo._("mv-gsheets-write-permission-denied"));
						return true;
					case 404:
						// No spreadsheet
						this.mavo.error(this.mavo._("mv-gsheets-spreadsheet-not-found"));
						return true;
					default:
						res = e;
				}
			}

			if (res.response && res.status !== 200) { // res.status == 400
				if (this.sheet) {
					// It might be there is no sheet with the specified name.
					// Let's check it.
					const spreadsheet = await this.request(_.buildURL(this.spreadsheet));
					const sheet = spreadsheet.sheets?.find?.(sheet => sheet.properties?.title === this.sheet);

					if (!sheet) {
						// There is no. Let's try to create one.
						const req = {
							"requests": [
								{
									"addSheet": {
										"properties": {
											"title": this.sheet
										}
									}
								}
							]
						};

						try {
							await this.request(_.buildURL(`${this.spreadsheet}:batchUpdate`), req, "POST");

							// Warn a user about the newly created sheet.
							Mavo.warn(this.mavo._("mv-gsheets-no-sheet-to-store-data", { name: this.sheet }));

							// Try to store data one more time.
							res = await this.request(url, body, "PUT");
						} catch (e) {
							res = e;
						}
					}
				}

				// Something went wrong?
				if (res.response && res.status !== 200) {
					if (res.response.error.message.startsWith("Unable to parse range")) {
						// Invalid range
						this.mavo.error(this.mavo._("mv-gsheets-invalid-range"));
					}
					else if (res.response.error.message.startsWith("Requested writing within range")) {
						// The range is too small
						this.mavo.error(this.mavo._("mv-gsheets-small-range"));
					}
					else if (res.response.error.message.includes("protected cell or object")) {
						// The sheet and/or range is protected
						this.mavo.error(res.response.error.message);
					}
					else if (res.response.error.message.startsWith("Invalid values")) {
						// An app's data structure is not supported
						this.mavo.error(this.mavo._("mv-gsheets-unsupported-data-structure"));
						Mavo.warn(res.response.error.message);
					}
					else {
						// Unknown error
						Mavo.warn(res.response.error.message);
					}

					return true;
				}
			};

			// Saved successfully, update the fields.
			this.loadedData = res.updatedData.values;
			this.recordCount = recordCount;

			return res;
		}

		async login (passive) {
			try {
				await this.oAuthenticate(passive);
				await this.getUser();

				if (this.user) {
					this.permissions.on(["save", "logout"]);
				}
			} catch (e) {
				if (e.status === 401) {
					// Unauthorized. Access token we have is invalid, discard it.
					await this.logout();
				}
			}
		}

		async logout () {
			await this.oAuthLogout();

			this.user = null;
			this.permissions.on(["edit", "add", "delete"]);
		}

		async getUser () {
			if (this.user) {
				return this.user;
			}

			const info = await this.request("https://www.googleapis.com/oauth2/v2/userinfo");

			this.user = {
				name: info.name,
				avatar: info.picture,
				info
			};

			// Make the plugin work both with stable and future versions of Mavo.
			if (this instanceof EventTarget) {
				$.fire(this, "mv-login");
			}
			else {
				// Mavo v0.2.4-
				$.fire(this.mavo.element, "mv-login", { backend: this });
			}
		}

		/**
		 * If neither sheet title nor range is provided, we should use some default range to get/read data from/to.
		 * Otherwise, a request to a spreadsheet will fail, and we don't want it.
		 * Let's use all cells of the first visible sheet by default. To do that, we need to provide its title.
		 */
		async findSheet (o = {}) {
			const url = _.buildURL(this.spreadsheet, { key: this.apikey });

			let response;
			if (this.isAuthenticated()) {
				response = await fetch(url.href, {
					headers: {
						Authorization: `Bearer ${this.accessToken}`
					},
				});

				if (response.status === 401) {
					// Access token we have is invalid, discard it.
					// But in case we are getting data, we can still try an unauthenticated request.
					await this.logout();
				}
			}

			if (!o.isStoring && !this.isAuthenticated()) {
				response = await fetch(url.href);
			}

			// The request failed? It doesn't make sense to proceed.
			if (!response.ok) {
				return Promise.reject(response);
			}

			const spreadsheet = await response.json();

			const visibleSheet = spreadsheet.sheets?.find?.(sheet => !sheet.properties?.hidden);

			// Why this.sheet in the right part of the assignment operator?
			// If the sheet name is a result of an expression, we want to use it instead of the title of the first visible sheet.
			this.sheet = this.sheet ?? visibleSheet?.properties?.title;
		}

		oAuthParams = () => `&redirect_uri=${encodeURIComponent("https://auth.mavo.io")}&response_type=code&scope=${encodeURIComponent(_.scopes.join(" "))}`

		static apiDomain = "https://sheets.googleapis.com/v4/spreadsheets/"
		static oAuth = "https://accounts.google.com/o/oauth2/auth"
		static scopes = [
			"https://www.googleapis.com/auth/spreadsheets",
			"https://www.googleapis.com/auth/userinfo.profile"
		]
		static key = "380712995757-4e9augrln1ck0soj8qgou0b4tnr30o42.apps.googleusercontent.com" // Client ID for PUT requests
		static useCache = false // We don't want to set the timestamp on all requests

		/**
		 * Determines whether the Google Sheets backend is used.
		 * @param {string} value The mv-storage/mv-source/mv-init value.
		 */
		static test (value) {
			return /^https:\/\/docs.google.com\/spreadsheets\/?.*/.test(value);
		}

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
		static zipObject (props, values) {
			return props.reduce((prev, prop, i) => {
				// Skip empty property names (and corresponding data) since they are useless.
				if (!prop.trim?.()?.length) {
					return prev;
				}

				return Object.assign(prev, {
					[prop]: values[i]
				});
			}, {});
		}

		/**
		 * Returns a newly created URL object with provided as an argument query parameters.
		 * @param {string} url Relative URL.
		 * @param {object} params Query parameters.
		 */
		static buildURL (url, params = {}) {
			const ret = new URL(url, _.apiDomain);

			for (const p in params) {
				ret.searchParams.set(p, params[p]);
			}

			return ret;
		}
	});

	Mavo.Locale.register("en", {
		"mv-gsheets-range-not-provided": "If there is more than one table with data on a sheet, you should provide a range with the needed data. For more information, see the plugin docs.",
		"mv-gsheets-empty-cells-in-headings": "It looks like not all your data has headings. Please, make sure that the row/column with headings hasn't got empty cells.",
		"mv-gsheets-login-to-proceed": "You must be logged in to save data to the spreadsheet. Re-login and try again.",
		"mv-gsheets-write-permission-denied": "You don't have permission to save data to the spreadsheet.",
		"mv-gsheets-read-permission-denied": "You don't have permission to read data from the spreadsheet.",
		"mv-gsheets-unsupported-data-structure": "It looks like your app's data has a structure that is not supported by the GSheets plugin.",
		"mv-gsheets-spreadsheet-not-found": "We couldn't find the spreadsheet you specified.",
		"mv-gsheets-no-sheet-or-invalid-range": "There is no sheet with the specified name in the spreadsheet, and/or the format you used to specify the data range is invalid.",
		"mv-gsheets-invalid-range": "The format you used to specify the data range for storing your data is invalid.",
		"mv-gsheets-no-sheet-to-store-data": "We couldn't find the {name} sheet in the spreadsheet and created it.",
		"mv-gsheets-small-range": "The range you specified isn't large enough to store all your data."
	});
})(Bliss, Mavo.Functions);
