const fs = require('fs');
let code = fs.readFileSync('k:\\\\WEBSIT\\\\Awladelkady\\\\Admin\\\\assets\\\\js\\\\admin.js', 'utf8');

code = code.replace('function initOrdersSystem() {', 'async function initOrdersSystem() {\\n    sampleOrders = await sb_fetch(\\'orders\\');');
code = code.replace('function initProductsAndCategories() {', 'async function initProductsAndCategories() {\\n    sampleProducts = await sb_fetch(\\'products\\');\\n    sampleCategories = await sb_fetch(\\'categories\\');');
code = code.replace('function initComplaintsSystem() {', 'async function initComplaintsSystem() {\\n    sampleComplaints = await sb_fetch(\\'complaints\\');');

code = code.replace(/window\.promptAddImageSlot = function\(index\) {[\s\S]*?\};/, `
window.promptAddImageSlot = function(index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async e => {
        const file = e.target.files[0];
        if(!file) return;
        try {
            const url = await sb_upload(file);
            const isMain = index === 0;
            currentEditingImages[index] = { url, main: isMain };
            renderGalleryUploaderSlots(currentEditingImages);
        } catch(err) {
            alert('Upload failed');
        }
    };
    input.click();
};
`);

code = code.replace(/if \(editId\) {[\s\S]*?else {[\s\S]*?sampleProducts\.unshift\(newProd\);\s*}/, `
if (editId) {
    await sb_update('products', editId, newProd);
    const idx = sampleProducts.findIndex(p => p.id == editId);
    if (idx !== -1) sampleProducts[idx] = newProd;
} else {
    delete newProd.id;
    await sb_insert('products', newProd);
    sampleProducts = await sb_fetch('products');
}
`);

code = code.replace(/if \(editId\) {[\s\S]*?else {[\s\S]*?sampleCategories\.push\(\{ id: Date\.now\(\), name, desc \}\);\s*}/, `
if (editId) {
    await sb_update('categories', editId, {name, desc});
    const cat = sampleCategories.find(c => c.id == editId);
    if (cat) { cat.name = name; cat.desc = desc; }
} else {
    await sb_insert('categories', {name, desc});
    sampleCategories = await sb_fetch('categories');
}
`);

code = code.replace(/sampleProducts = sampleProducts\.filter\(p => p\.id !== id\);/, `await sb_delete('products', id); sampleProducts = sampleProducts.filter(p => p.id !== id);`);
code = code.replace(/sampleCategories = sampleCategories\.filter\(c => c\.id !== id\);/, `await sb_delete('categories', id); sampleCategories = sampleCategories.filter(c => c.id !== id);`);

code = code.replace("productForm.addEventListener('submit', (e) => {", "productForm.addEventListener('submit', async (e) => {");
code = code.replace("categoryForm.addEventListener('submit', (e) => {", "categoryForm.addEventListener('submit', async (e) => {");

code = code.replace(/c\.status = 'resolved';/, `await sb_update('complaints', activeComplaintId, {status: 'resolved'}); c.status = 'resolved';`);
code = code.replace("resolveBtn.addEventListener('click', () => {", "resolveBtn.addEventListener('click', async () => {");
code = code.replace(/window\.deleteProduct = function\(id\) {/, "window.deleteProduct = async function(id) {");
code = code.replace(/window\.deleteCategory = function\(id\) {/, "window.deleteCategory = async function(id) {");

fs.writeFileSync('k:\\\\WEBSIT\\\\Awladelkady\\\\Admin\\\\assets\\\\js\\\\admin.js', code);
