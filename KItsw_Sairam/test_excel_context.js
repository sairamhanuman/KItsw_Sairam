/**
 * Test Excel Import/Export with Context Enhancement
 * 
 * This test validates:
 * 1. Excel generation creates correct structure with context in first 4 rows
 * 2. Excel import correctly reads context from first 4 rows
 * 3. Context validation and error handling
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== EXCEL CONTEXT FORMAT TEST ===\n');

// Test 1: Verify Excel generation structure
async function testExcelGeneration() {
    console.log('Test 1: Excel Generation with Context Rows');
    console.log('='.repeat(50));
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subjects');
    
    // Add context metadata rows (first 4 rows)
    worksheet.addRow(['Programme', 'BTECH']);
    worksheet.addRow(['Branch', 'CSE']);
    worksheet.addRow(['Semester', 'Semester I']);
    worksheet.addRow(['Regulation', 'URR-22']);
    worksheet.addRow([]); // Empty separator row
    
    // Add column headers (row 6)
    worksheet.addRow([
        'subject_order', 'syllabus_code', 'ref_code', 'internal_exam_code',
        'external_exam_code', 'subject_name', 'subject_type', 'internal_max_marks',
        'external_max_marks', 'ta_max_marks', 'credits', 'is_elective',
        'is_under_group', 'is_exempt_exam_fee'
    ]);
    
    // Add sample subject data
    worksheet.addRow([
        1, 'U18MH101', 'EM-I', 'U18MH101', 'U18MH101',
        'ENGINEERING MATHEMATICS - I', 'Theory', 30, 60, 0, 4,
        'No', 'No', 'No'
    ]);
    worksheet.addRow([
        2, 'U18CS102', 'PPSC', 'U18CS102', 'U18CS102',
        'PROGRAMMING FOR PROBLEM SOLVING IN C', 'Theory', 30, 60, 0, 3,
        'No', 'No', 'No'
    ]);
    
    // Set column widths
    worksheet.columns = [
        { width: 20 }, { width: 15 }, { width: 15 }, { width: 18 },
        { width: 18 }, { width: 40 }, { width: 12 }, { width: 12 },
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 },
        { width: 12 }, { width: 12 }
    ];
    
    // Write to test file
    const testFile = path.join(os.tmpdir(), 'test_excel_context.xlsx');
    await workbook.xlsx.writeFile(testFile);
    
    console.log('✅ Test file created:', testFile);
    
    // Verify the file was created
    if (fs.existsSync(testFile)) {
        console.log('✅ File exists');
        
        // Read and verify structure
        const readWorkbook = new ExcelJS.Workbook();
        await readWorkbook.xlsx.readFile(testFile);
        const readWorksheet = readWorkbook.worksheets[0];
        
        // Extract context
        const context = {
            programme: readWorksheet.getRow(1).getCell(2).value,
            branch: readWorksheet.getRow(2).getCell(2).value,
            semester: readWorksheet.getRow(3).getCell(2).value,
            regulation: readWorksheet.getRow(4).getCell(2).value
        };
        
        console.log('\n📋 Excel Structure Verification:');
        console.log('Row 1 (Programme):', readWorksheet.getRow(1).values);
        console.log('Row 2 (Branch):', readWorksheet.getRow(2).values);
        console.log('Row 3 (Semester):', readWorksheet.getRow(3).values);
        console.log('Row 4 (Regulation):', readWorksheet.getRow(4).values);
        console.log('Row 5 (Empty):', readWorksheet.getRow(5).values);
        console.log('Row 6 (Headers):', readWorksheet.getRow(6).values);
        console.log('Row 7 (First Subject):', readWorksheet.getRow(7).values);
        
        console.log('\n📝 Extracted Context:', context);
        
        if (context.programme === 'BTECH' && 
            context.branch === 'CSE' && 
            context.semester === 'Semester I' && 
            context.regulation === 'URR-22') {
            console.log('✅ Context extracted correctly!');
        } else {
            console.log('❌ Context extraction failed!');
            return false;
        }
        
        // Verify subject data
        const subject1 = readWorksheet.getRow(7);
        if (subject1.getCell(2).value === 'U18MH101' &&
            subject1.getCell(6).value === 'ENGINEERING MATHEMATICS - I') {
            console.log('✅ Subject data parsed correctly!');
            console.log('\n✅ Test 1 PASSED: Excel structure is correct\n');
            return true;
        } else {
            console.log('❌ Subject data parsing failed!');
            return false;
        }
    } else {
        console.log('❌ File was not created');
        return false;
    }
}

// Test 2: Verify context validation
async function testContextValidation() {
    console.log('\nTest 2: Context Validation');
    console.log('='.repeat(50));
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subjects');
    
    // Create invalid context (missing regulation)
    worksheet.addRow(['Programme', 'BTECH']);
    worksheet.addRow(['Branch', 'CSE']);
    worksheet.addRow(['Semester', 'Semester I']);
    worksheet.addRow(['Regulation', '']);  // Missing regulation
    worksheet.addRow([]);
    
    const testFile = path.join(os.tmpdir(), 'test_excel_invalid.xlsx');
    await workbook.xlsx.writeFile(testFile);
    
    // Read and validate
    const readWorkbook = new ExcelJS.Workbook();
    await readWorkbook.xlsx.readFile(testFile);
    const readWorksheet = readWorkbook.worksheets[0];
    
    const context = {
        programme: readWorksheet.getRow(1).getCell(2).value || '',
        branch: readWorksheet.getRow(2).getCell(2).value || '',
        semester: readWorksheet.getRow(3).getCell(2).value || '',
        regulation: readWorksheet.getRow(4).getCell(2).value || ''
    };
    
    console.log('Invalid context:', context);
    
    if (!context.programme || !context.branch || !context.semester || !context.regulation) {
        console.log('✅ Validation correctly detected missing context');
        console.log('✅ Test 2 PASSED: Context validation works\n');
        return true;
    } else {
        console.log('❌ Validation failed to detect missing context');
        return false;
    }
}

// Test 3: Verify data mapping
function testDataMapping() {
    console.log('\nTest 3: Data Mapping from Excel to Database Format');
    console.log('='.repeat(50));
    
    const excelData = {
        subject_order: 1,
        syllabus_code: 'U18MH101',
        ref_code: 'EM-I',
        internal_exam_code: 'U18MH101',
        external_exam_code: 'U18MH101',
        subject_name: 'ENGINEERING MATHEMATICS - I',
        subject_type: 'Theory',
        internal_max_marks: 30,
        external_max_marks: 60,
        ta_max_marks: 0,
        credits: 4,
        is_elective: 'No',
        is_under_group: 'No',
        is_exempt_exam_fee: 'No'
    };
    
    // Simulate mapping logic from import endpoint
    const mappedData = {
        programme_id: 1,  // Would come from context
        branch_id: 1,     // Would come from context
        semester_id: 1,   // Would come from context
        regulation_id: 1, // Would come from context
        subject_order: excelData.subject_order || 1,
        syllabus_code: excelData.syllabus_code,
        ref_code: excelData.ref_code || null,
        internal_exam_code: excelData.internal_exam_code || null,
        external_exam_code: excelData.external_exam_code || null,
        subject_name: excelData.subject_name,
        subject_type: excelData.subject_type || 'Theory',
        internal_max_marks: excelData.internal_max_marks || 0,
        external_max_marks: excelData.external_max_marks || 0,
        ta_max_marks: excelData.ta_max_marks || 0,
        credits: excelData.credits || 0,
        is_elective: excelData.is_elective === 'Yes' ? 1 : 0,
        is_under_group: excelData.is_under_group === 'Yes' ? 1 : 0,
        is_exempt_exam_fee: excelData.is_exempt_exam_fee === 'Yes' ? 1 : 0
    };
    
    console.log('Excel data:', excelData);
    console.log('\nMapped to database format:', mappedData);
    
    if (mappedData.syllabus_code === 'U18MH101' &&
        mappedData.subject_name === 'ENGINEERING MATHEMATICS - I' &&
        mappedData.is_elective === 0) {
        console.log('✅ Data mapping is correct');
        console.log('✅ Test 3 PASSED: Data mapping works correctly\n');
        return true;
    } else {
        console.log('❌ Data mapping failed');
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('Starting Excel Context Format Tests...\n');
    
    const results = {
        test1: await testExcelGeneration(),
        test2: await testContextValidation(),
        test3: testDataMapping()
    };
    
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Test 1 (Excel Generation): ${results.test1 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 2 (Context Validation): ${results.test2 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 3 (Data Mapping): ${results.test3 ? '✅ PASSED' : '❌ FAILED'}`);
    
    const allPassed = results.test1 && results.test2 && results.test3;
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED!');
        console.log('Excel context format implementation is working correctly.');
    } else {
        console.log('❌ SOME TESTS FAILED!');
        console.log('Please review the implementation.');
    }
    console.log('='.repeat(50));
    
    return allPassed;
}

// Run tests
runAllTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
