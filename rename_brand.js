const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'package.json',
  '.github/workflows/ci-cd.yml',
  'supabase_schema.sql',
  'architecture_review.md',
  'architecture.md.resolved',
  'task.md',
  'walkthrough2',
  'src/app.js',
  'src/config/swagger.js',
  'tests/api.test.js',
  'src/services/assistant.service.js',
  'client/index.html',
  'client/src/layouts/AuthLayout.jsx',
  'client/src/layouts/SuperAdminLayout.jsx',
  'client/src/layouts/VendorLayout.jsx',
  'client/src/layouts/SecurityLayout.jsx',
  'client/src/layouts/AdminLayout.jsx',
  'client/src/layouts/MainLayout.jsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace "Smart Apartment Management Platform" and similar with "SyncLiving — Smart Society Management Platform"
    content = content.replace(/Smart Apartment Management Platform/gi, 'SyncLiving — Smart Society Management Platform');
    content = content.replace(/Smart Apartment Management System/gi, 'SyncLiving — Smart Society Management Platform');
    content = content.replace(/Smart Apartment Platform/gi, 'SyncLiving — Smart Society Management Platform');
    
    // Specifically for swagger title
    content = content.replace(/SyncLiving — Smart Society Management Platform API/gi, 'SyncLiving API');

    // For other standalone instances of "Smart Apartment"
    content = content.replace(/Smart Apartment account/gi, 'SyncLiving account');
    content = content.replace(/Smart Apartment API/gi, 'SyncLiving API');
    content = content.replace(/Smart Apartment Management assistant/gi, 'SyncLiving AI Society Assistant');
    content = content.replace(/Smart Apartment/gi, 'SyncLiving');
    
    // Replace SmartApt with SyncLiving
    content = content.replace(/SmartApt/g, 'SyncLiving');

    // Ensure client title is updated
    if (file === 'client/index.html') {
      content = content.replace(/<title>client<\/title>/g, '<title>SyncLiving — Smart Society Management Platform</title>');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
