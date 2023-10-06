const fs = require('fs');

const getStorage = (filePath, type) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        if (type === 'csv') 
            return csvToObject(data);
        else {
            const parsedData = data.toString();
            return parsedData.split('\n');
        }
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
}
  
const csvToObject = (csvData) => {
    const rows = csvData.trim().split('\n');
    const headers = rows.shift().split(',');
    const data = rows.map((row) => {
            const values = row.split(',');
            const obj = {};
            headers.forEach((header, index) => {
            obj[header.trim()] = values[index].trim();
        });
        return obj;
    });
    return data;
}

function objectToCsv(data) {
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map((obj) => Object.values(obj).join(',') + '\n');
    return header + rows.join('');
}

const appendStorage = async (filePath, data) => {
    try {
        await fs.appendFileSync(filePath, data);
    } catch (error) {
        console.error('Error writing file:', error);
    }
}

const updateStorage = (filePath, conditionField, conditionValue, newData) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return;
      }
  
      const rows = data.trim().split('\n');
      const headers = rows.shift().split(',');
  
      const updatedRows = rows.map((row) => {
        const values = row.split(',');
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index];
        });
  
        if (rowData[conditionField] === conditionValue) {
          Object.assign(rowData, newData);
        }
  
        return headers.map((header) => rowData[header]).join(',');
      });
  
      const updatedCsvData = [headers.join(','), ...updatedRows].join('\n');
  
      fs.writeFile(filePath, updatedCsvData, 'utf8', (err) => {
        if (err) {
          console.error('Error updating row in CSV:', err);
          return;
        }
        console.log('Row updated successfully.');
      });
    });
}

module.exports = {
    // csvToJson,
    appendStorage,
    // getValueStorage,
    updateStorage,
    getStorage
}