import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const workbookPath = '/Users/brandonsterling/Downloads/RSOS_V1_2_STABLE_PRODUCTION_BUILD_CLEAN_NO_COMMAND_SHIFT.xlsx';

function getWorkbookInfo() {
  const exists = fs.existsSync(workbookPath);

  if (!exists) {
    return {
      connected: false,
      workbookFilename: path.basename(workbookPath),
      workbookPath,
      worksheetNames: [],
      dealIntakeFound: false,
      dealIntakeHeaders: [],
      dealIntakeLocations: {},
      readyForWrite: false,
      message: 'Workbook not found.'
    };
  }

  try {
    const unzip = execFileSync('python3', ['-c', `import zipfile, json, sys; p=sys.argv[1]; z=zipfile.ZipFile(p); names=[n for n in z.namelist() if n.startswith('xl/workSheets/sheet')]; print(json.dumps(names))`, workbookPath], { encoding: 'utf8' });
    const sheetNames = JSON.parse(unzip);
    const worksheetNames = sheetNames.map((name) => name.split('/').pop().replace('.xml',''));

    return {
      connected: true,
      workbookFilename: path.basename(workbookPath),
      workbookPath,
      worksheetNames,
      dealIntakeFound: worksheetNames.some((name) => name.toLowerCase().includes('deal') && name.toLowerCase().includes('intake')),
      dealIntakeHeaders: [],
      dealIntakeLocations: {},
      readyForWrite: false,
      message: 'Workbook opened successfully in read-only mode.'
    };
  } catch (error) {
    return {
      connected: false,
      workbookFilename: path.basename(workbookPath),
      workbookPath,
      worksheetNames: [],
      dealIntakeFound: false,
      dealIntakeHeaders: [],
      dealIntakeLocations: {},
      readyForWrite: false,
      message: error.message
    };
  }
}

console.log(JSON.stringify(getWorkbookInfo(), null, 2));
