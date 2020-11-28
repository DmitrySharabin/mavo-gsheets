# Google Sheets Backend

## Prerequisites

To use the features provided by this plugin, you need a Google account.

## Restrictions

Only one collection. Property names inside the collection must correspond to headers in a spreadsheet, or the `mv-gs-idify-headers` attribute must present on the app root.

## Step 1: Turn on the Google Sheets API and Create API key

Follow [Step 1 of this instruction](https://developers.google.com/sheets/api/quickstart/js): consequentially click the `Enable the Google Sheets API` and `Create API key` buttons.

Use the provided **API key** as a value for `mv-gs-key`.

**Note:** Keep **Client ID** in secret and don't include it in your app.

## Step 2: Share a spreadsheet

Use provided **URL** as a value for `mv-storage`/`mv-source`/`mv-init`.

## Supported Attributes

| Attribute             | Description                                                                                                                                                                                               | Default Value        |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------|
| `mv-gs-key`           | (Required) The API key.                                                                                                                                                                                   |                      |
| `mv-gs-sheet`         | A sheet's title (which must be unique inside a spreadsheet).                                                                                                                                              | `Sheet1`             |
| `mv-gs-range`         | A range with data in *A1 notation*. If not specified, supposed all the cells in the sheet. For more information about A1 notation, see the description below.                                                       |                      |
| `mv-gs-data-in`       | Indicates how data is organized on the specified sheet: in `rows` or `columns`.                                                                                                                            | `rows`               |
| `mv-gs-values`        | Determines whether values should be displayed according to the cell's formatting on the sheet (`formatted_values`) or not (`unformatted_values`).                                                         | `unformatted_values` |
| `mv-gs-idify-headers` | If present, data headers will be converted to something that looks like the ids so that they could be used as property names. This is useful when headers contain spaces and/or other special characters. |                      |

## A1 notation for specifying cell ranges

This is a string like `A1:B2` that refers to a group of cells in the sheet and is typically used in formulas. For example, valid ranges are:

- `A1:B2` refers to the first two cells in the top two rows of the sheet.
- `A:A` refers to all the cells in the first column of the sheet.
- `1:2` refers to all the cells in the first two rows of the sheet.
- `A5:A` refers to all the cells of the first column of the sheet, from row 5 onward.
- `A1:B2` refers to the first two cells in the top two rows of the first visible sheet.

If not specified, supposed all the cells in the sheet.

Named ranges are also supported.
