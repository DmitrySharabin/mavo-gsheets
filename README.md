# Google Sheets Backend

## Restrictions

Data must have headers:

- in the *first row of the specified range*, if data is organized in rows
- otherwise, in the *first column*.

Only one collection. Property names inside the collection must correspond to headers in a spreadsheet, or the `transformHeaders` option must be provided in the `mv-gsheets-options` attribute.

## Setting Up

Share a spreadsheet and use the provided **URL** as a value for `mv-storage`/`mv-source`/`mv-init`.

## Supported Attributes

| Attribute     | Description                                                                                | Default Value |
|---------------|--------------------------------------------------------------------------------------------|---------------|
| `mv-gsheets-sheet` | A sheet title to read data from.                                                           | `Sheet1`      |
| `mv-gsheets-range` | A range with data in *A1 notation*. If not specified, supposed all the cells in the sheet. |               |

## A1 notation for specifying cell ranges

This is a string like `A1:B2` that refers to a group of cells in the sheet and is typically used in formulas. For example, valid ranges are:

- `A1:B2` refers to the first two cells in the top two rows of the sheet.
- `A:A` refers to all the cells in the first column of the sheet.
- `1:2` refers to all the cells in the first two rows of the sheet.
- `A5:A` refers to all the cells of the first column of the sheet, from row 5 onward.
- `A1:B2` refers to the first two cells in the top two rows of the first visible sheet.

If not specified, supposed all the cells in the sheet.

Named ranges are also supported.

## Customization

The plugin supports a number of options for customizing the way it reads/writes data from/to a spreadsheet. You can specify these options by using the `mv-gsheets-options` attribute. To separating the options, you can use either commas or semicolons.

### Supported options

| Option             | Description                                                                                                                        |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `formattedValues`  | Determines whether values should be displayed according to the cell's formatting on the sheet (if this option is provided) or not. |
| `dataInColumns`    | If provided, that indicates that data is organized on the specified sheet in columns.                                              |
| `transformHeaders` | If provided, the plugin will convert headers to something that looks like the ids so that they could be used as property names.    |


<h2>Demo</h2>

```markup
<div mv-app="todoApp" mv-plugins="gsheets"
		mv-source="https://docs.google.com/spreadsheets/d/14bzCuziKutrA3iESarKoj2o56dhraR8pzuFAuwTIo-g/edit?usp=sharing"
		mv-gsheets-sheet="Todos">

	<h2>Todo List</h2>
	<p mv-multiple="todo">
		<label>
			<input type="checkbox" property="done" />
			<span property="taskTitle"></span>
		</label>
	</p>
</div>

<div mv-app mv-plugins="gsheets"
	 mv-source="https://docs.google.com/spreadsheets/d//14bzCuziKutrA3iESarKoj2o56dhraR8pzuFAuwTIo-g/edit?usp=sharing"
	 mv-gsheets-sheet="In columns"
	 mv-gsheets-range="1:2"
	 mv-gsheets-options="dataInColumns, transformHeaders">

	<h2>Data in Columns</h2>
	<p property mv-multiple>
		<span property="id"></span>
		<span property="value"></span>
	</p>
</div>
```
