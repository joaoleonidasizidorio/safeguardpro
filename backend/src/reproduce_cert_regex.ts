import { describe, it } from 'node:test';
import assert from 'node:assert';

// The logic from backend/src/index.ts (approx line 5116)
function performSubstitution(template: string, data: any) {
    const { employeeName, employeeCpf, courseName, companyName, trainingDate, validityDate } = data;

    return template
        .replace(/{nome}|{name}/gi, employeeName)
        .replace(/{cpf}/gi, employeeCpf)
        .replace(/{curso}|{course}/gi, courseName)
        .replace(/{empresa}|{company}/gi, companyName)
        .replace(/{data}|{date}/gi, trainingDate)
        .replace(/{validade}|{validity}/gi, validityDate);
}

// Mock Data
const mockData = {
    employeeName: 'JOÃO DA SILVA',
    employeeCpf: '123.456.789-00',
    courseName: 'NR-10 BÁSICO',
    companyName: 'EMPRESA TESTE LTDA',
    trainingDate: '01/01/2026',
    validityDate: '01/01/2028'
};

console.log('--- START REPRODUCTION TESTS ---');

// Test 1: Standard (matches database)
const t1 = `Certificamos que {nome}, portador do CPF {cpf}, concluiu {curso}.`;
const r1 = performSubstitution(t1, mockData);
console.log(`Test 1 (Standard): ${r1 === 'Certificamos que JOÃO DA SILVA, portador do CPF 123.456.789-00, concluiu NR-10 BÁSICO.' ? 'PASS' : 'FAIL'}`);
console.log(`   -> Result: ${r1}\n`);

// Test 2: With Spaces (Potential User Error)
const t2 = `Certificamos que { nome }, cpf {  cpf  }.`;
const r2 = performSubstitution(t2, mockData);
console.log(`Test 2 (Spaces): ${r2.includes('JOÃO') ? 'PASS' : 'FAIL'}`);
console.log(`   -> Result: ${r2}\n`);

// Test 3: Case Variations
const t3 = `Certificamos que {NoMe}, cpf {CPF}.`;
const r3 = performSubstitution(t3, mockData);
console.log(`Test 3 (Case): ${r3.includes('JOÃO') ? 'PASS' : 'FAIL'}`);
console.log(`   -> Result: ${r3}\n`);

// Test 4: Missing Data (Undefined)
const emptyData = { ...mockData, employeeName: undefined }; // This shouldn't happen due to defaults, but testing replace behavior
// The real code defaults to 'FUNCIONÁRIO DESCONHECIDO' before calling replace, so I will simulate that fallback.
const safeData = { ...mockData, employeeName: 'FUNCIONÁRIO DESCONHECIDO' };
const r4 = performSubstitution(t1, safeData);
console.log(`Test 4 (Default): ${r4.includes('FUNCIONÁRIO') ? 'PASS' : 'FAIL'}`);
console.log(`   -> Result: ${r4}\n`);
