# Google Sheets Backend

**Warning:** It's an alpha version of the plugin—something might change in it. We are planning to make it more powerful shortly, so stay in touch and tell us what you think.

## Restrictions

Data must have headings:

- in the *first row of the specified range*, if data is organized in rows
- otherwise, in the *first column*.

Only one collection. Property names inside the collection must correspond to headings in a spreadsheet, or the `transformHeadings` option must be provided in the `mv-storage-options` (`mv-source-options`, `mv-init-options`) attribute.

## Setting Up

Share a spreadsheet and use the provided **URL** as a value for `mv-storage`/`mv-source`/`mv-init` and specify additional parameters via the `mv-storage-*`/`mv-source-*`/`mv-init-*` family of attributes if needed.

To write data back to the spreadsheet (if allowed by specified permissions), users must log in.

**Warning!** If you don't specify a range where to put data, **all data on the sheet** you put your data on will be erased before writing the new data.

The plugin supports *private spreadsheets* as well. However, to read data from and write them back to a private spreadsheet, you *must* log in. The plugin won't let you work with *other's private spreadsheets*, only yours.

**Note:** You can find additional information about sharing a spreadsheet with the corresponding permissions in the [Google Sheets help](https://support.google.com/docs/answer/2494822?hl=en).

## Supported values of the `mv-storage-*` (`mv-source-*`, `mv-init-*`) family of attributes

| Value         | Description                                                                                             |
|---------------|---------------------------------------------------------------------------------------------------------|
| `sheet`       | (*Optional*) A sheet title to read data from. If not provided, the first visible sheet will be used.    |
| `range`       | (*Optional*) A range with data in *A1 notation*. If not specified, supposed all the cells in the sheet. |
| `spreadsheet` | (*Optional*) A spreadsheet id. The value between the `/d/` and the `/edit` in the URL of a spreadsheet. By specifying this value, you can redefine the spreadsheet id the plugin got from the provided spreadsheet URL. In other words, you'll be able to work with another spreadsheet. |

**Note:** We recommend providing either *sheet title* or *range* to avoid extra network requests.
## A1 notation for specifying cell ranges

This is a string like `A1:B2` that refers to a group of cells in the sheet (the first visible sheet) and is typically used in formulas. For example, valid ranges are:

- `A1:B2` refers to the first two cells in the top two rows of the sheet.
- `A:C` refers to all the cells in the first three columns of the sheet.
- `1:2` refers to all the cells in the first two rows of the sheet.
- `A5:A` refers to all the cells of the first column of the sheet, from row 5 onward.
- `C2:2` refers to all the cells of the second row of the sheet, from column C onward.

If not specified, supposed all the cells in the sheet.

Named ranges are also supported.

## Customization

The plugin supports a number of options for customizing the way it reads/writes data from/to a spreadsheet. You can specify these options by using the `mv-storage-options` (`mv-source-options`, `mv-init-options`) attribute. To separating the options, you can use either commas or semicolons.

### Supported options

| Option             | Description                                                                                                                        |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `formattedValues`  | Determines whether values should be displayed according to the cell's formatting on the sheet (if this option is provided) or not. |
| `dataInColumns`    | If provided, that indicates that data is organized on the specified sheet in columns.                                              |
| `transformHeadings` | If provided, the plugin will convert headings to something that looks like the ids so that they could be used as property names.    |

### Localization strings

| id                                      | Value                                                                                                                                             |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `mv-gsheets-range-not-provided`         | If there is more than one table with data on a sheet, you should provide a range with the needed data. For more information, see the plugin docs. |
| `mv-gsheets-empty-cells-in-headings`    | It looks like not all your data has headings. Please, make sure that the row/column with headings hasn't got empty cells.                         |
| `mv-gsheets-write-permission-denied`    | You don't have permission to save data to the spreadsheet.                                                                                        |
| `mv-gsheets-read-permission-denied`     | You don't have permission to read data from the spreadsheet.                                                                                      |
| `mv-gsheets-unsupported-data-structure` | It looks like your app's data has a structure that is not supported by the GSheets plugin.                                                        |

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
