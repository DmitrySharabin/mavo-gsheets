# Google Sheets Backend

**Note:** Below, everything that applied to `mv-storage` could be applied to `mv-source` and `mv-init` as well.

## Restrictions

1. Data must have headings:
   - in the *first row of the specified range*, if data is organized *in rows* (i.e., one row = one set of data)
   - in the *first column of the specified range*, if data is organized *in columns* (i.e., one column = one set of data).
2. The plugin can work with only one collection. If the app has more than one collection, only the *first* one will be used.
3. Property names inside the collection must correspond to headings in a spreadsheet. For example, if there is a row/column with the “year“ heading in the spreadsheet, to use data from this row/column inside the app, there should be the `year` property in the corresponding collection.

**Note:** The headings must contain **only** letters, numbers, and underscores (_). Otherwise, the `transformHeadings` option must be provided in the `mv-storage-options` attribute. In that case, the plugin will do its best to transform headings into [allowed names of properties](https://mavo.io/docs/properties#property-name-rules) automatically. For example, the “Month name” heading will be transformed into “month_name”.

### Example: Data in rows

| foo | bar | baz |
|-----|-----|-----|
|  1  |  2  |  3  |
|  4  |  5  |  6  |
|  7  |  8  |  9  |

### Example: Data in columns

<table>
 <tr><th>foo</th><td>1</td><td>4</td><td>7</td></tr>
 <tr><th>bar</th><td>2</td><td>5</td><td>8</td></tr>
 <tr><th>baz</th><td>3</td><td>6</td><td>9</td></tr>
</table>

## Setting Up

Share a spreadsheet and use the provided **URL** as a value for `mv-storage` and specify additional parameters via the `mv-storage-*` family of attributes if needed.

To write data back to the spreadsheet (if allowed by specified permissions), users must log in.

The plugin supports *private spreadsheets* as well. However, to read data from and write them back to a private spreadsheet, you *must* log in. The plugin won't let you work with *other's private spreadsheets*, only yours.

**Note:** You can find additional information about sharing a spreadsheet with the corresponding permissions in the [Google Sheets help](https://support.google.com/docs/answer/2494822?hl=en).

## Supported values of the `mv-storage-*` family of attributes

| Value         | Description                                                                                             |
|---------------|---------------------------------------------------------------------------------------------------------|
| `sheet`       | (*Optional*) A sheet title to read/write data from/to. If not provided, the first visible sheet will be used. <br /> **Note:** If there is no sheet with the specified name in the spreadsheet, it will be created while saving data.  |
| `range`       | (*Optional*) A range with data in *A1 notation*. If not specified, the plugin will try to find the first not empty range of cells with data. |
| `spreadsheet` | (*Optional*) A spreadsheet id. The value between the `/d/` and the `/edit` in the URL of a spreadsheet. By specifying this value, you can redefine the spreadsheet id the plugin got from the provided spreadsheet URL. In other words, you'll be able to work with another spreadsheet. |
| `options` | (*Optional*) The plugin supports a number of options for customizing the way it reads/writes data from/to a spreadsheet. The supported options are `formattedValues`, `dataInColumns`, and `transformHeadings`. For details, see the **Supported options** section below. |

**Note:** We recommend providing either *sheet title* or *range* to avoid extra network requests.

## A1 notation for specifying cell ranges

This is a string like `A1:B2` that refers to a group of cells in the sheet (the first visible sheet) and is typically used in formulas. For example, valid ranges are:

- `A1:B2` refers to the first two cells in the top two rows of the sheet.
- `A:C` refers to all the cells in the first three columns of the sheet.
- `1:2` refers to all the cells in the first two rows of the sheet.
- `A5:A` refers to all the cells of the first column of the sheet, from row 5 onward.
- `C2:2` refers to all the cells of the second row of the sheet, from column C onward.

**Note:** Named ranges are also supported.

## Customization

The plugin supports a number of options for customizing the way it reads/writes data from/to a spreadsheet. You can specify these options by using the `mv-storage-options` attribute. To separate the options, you can use either commas or semicolons. For example, `mv-storage-options="dataInColumns, transformHeadings"`.

### Supported options

| Option             | Description                                                                                                                        |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `formattedValues`  | Determines whether values should be displayed according to the cell's formatting on the sheet (if this option is provided) or not. |
| `dataInColumns`    | If provided, that indicates that data is organized *in columns* (i.e., one column = one set of data) and the headings are **in the first column** of the specified range, not the first row.                                              |
| `transformHeadings` | If provided, the plugin will convert headings so that they can be used as property names: will convert accented letters to [ASCII](https://en.wikipedia.org/wiki/ASCII), all the letters to lowercase, etc. **Hyphens and spaces will be converted into underscores.** For example, the “Month name” heading will be transformed into “month_name”.  |

### Localization strings

| id                                      | Value                                                                                                                                             |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `mv-gsheets-range-not-provided`         | If there is more than one table with data on a sheet, you should provide a range with the needed data. For more information, see the plugin docs. |
| `mv-gsheets-bad-headings`         | It looks like not all your headings can be used as property names. Please, make sure that all cells in the heading row/column are not empty and follow the property name rules (https://mavo.io/docs/properties#property-name-rules). In some cases, specifying the more narrow cell range and/or the transformHeadings option might help. The headings are: {headings}. |
| `mv-gsheets-login-to-proceed` | You must be logged in to save data to the spreadsheet. Re-login and try again. |
| `mv-gsheets-write-permission-denied`    | You don't have permission to save data to the spreadsheet.                                                                                        |
| `mv-gsheets-read-permission-denied`     | You don't have permission to read data from the spreadsheet.                                                                                      |
| `mv-gsheets-unsupported-data-structure` | It looks like your app's data has a structure that is not supported by the Google Sheets plugin.                                                        |
| `mv-gsheets-spreadsheet-not-found`      | We couldn't find the spreadsheet you specified.                                                                                                   |
| `mv-gsheets-no-sheet-or-invalid-range`  | There is no sheet with the specified name in the spreadsheet, and/or the format you used to specify the data range is invalid.                    |
| `mv-gsheets-invalid-range`              | The format you used to specify the data range for storing your data is invalid.                                                                   |
| `mv-gsheets-no-sheet-to-store-data`     | We couldn't find the ”{name}“ sheet in the spreadsheet and created it.                                                                              |
| `mv-gsheets-small-range`                | The range you specified isn't large enough to store all your data.                                                                                |

## Demo 1

```markup
<div mv-app="todoApp" mv-plugins="gsheets"
  mv-storage="https://docs.google.com/spreadsheets/d/14bzCuziKutrA3iESarKoj2o56dhraR8pzuFAuwTIo-g/edit?usp=sharing"
  mv-storage-sheet="Todos">

 <h2>Todo List</h2>
 <p mv-multiple="todo">
  <label>
   <input type="checkbox" property="done" />
   <span property="taskTitle"></span>
  </label>
 </p>
</div>
```

## Demo 2

```markup
<div mv-app mv-plugins="gsheets"
  mv-source="https://docs.google.com/spreadsheets/"
  mv-source-spreadsheet="14bzCuziKutrA3iESarKoj2o56dhraR8pzuFAuwTIo-g"
  mv-source-range="1:2"
  mv-source-options="dataInColumns, transformHeadings">

 <h2>Data in Columns</h2>
 <p property mv-multiple>
  <span property="id"></span>
  <span property="value"></span>
 </p>
</div>
```
