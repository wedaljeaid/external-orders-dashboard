
var fso = new ActiveXObject("Scripting.FileSystemObject");

function quote(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  var text = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");

  return '"' + text + '"';
}

function stringifyObject(obj) {
  var parts = [];
  var key;

  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      parts.push(quote(key) + ":" + quote(obj[key]));
    }
  }

  return "{" + parts.join(",") + "}";
}
function exportWorkbook(inputPath, outputPath) {
  var absoluteInput = fso.GetAbsolutePathName(inputPath);
  var absoluteOutput = fso.GetAbsolutePathName(outputPath);
  var outputDir = fso.GetParentFolderName(absoluteOutput);

  if (!fso.FolderExists(outputDir)) {
    fso.CreateFolder(outputDir);
  }

  var connection = new ActiveXObject("ADODB.Connection");
  connection.Open(
    "Provider=Microsoft.ACE.OLEDB.12.0;" +
      "Data Source=" + absoluteInput + ";" +
      "Extended Properties='Excel 12.0 Xml;HDR=YES;IMEX=1';"
  );

  var recordset = new ActiveXObject("ADODB.Recordset");
  recordset.Open("SELECT * FROM [Sheet1$]", connection, 3, 1);

  var rows = [];
  while (!recordset.EOF) {
    var row = {};
    for (var i = 0; i < recordset.Fields.Count; i += 1) {
      var field = recordset.Fields(i);
      row[field.Name] = field.Value === null ? "" : String(field.Value);
    }
    rows.push(stringifyObject(row));
    recordset.MoveNext();
  }

  recordset.Close();
  connection.Close();
  var payload =
    "{\n" +
    '  "generatedAt": ' +
    quote(new Date().toISOString()) +
    ",\n" +
    '  "records": [\n    ' +
    rows.join(",\n    ") +
    "\n  ]\n" +
    "}\n";

  var file = fso.CreateTextFile(absoluteOutput, true, true);
  file.Write(payload);
  file.Close();

  WScript.Echo("Exported " + rows.length + " rows to " + absoluteOutput);
}

if (WScript.Arguments.Length < 2) {
  WScript.Echo("Usage: cscript //nologo scripts\\export_excel_to_json.js <input.xlsx> <output.json>");
  WScript.Quit(1);
}

exportWorkbook(WScript.Arguments(0), WScript.Arguments(1));
