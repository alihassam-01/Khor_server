/**
 * Generate Bcrypt Hash for Admin Password
 * 
 * Usage: node scripts/generate-admin-password.js [password]
 * Example: node scripts/generate-admin-password.js MySecurePassword123!
 */

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'Admin@2026';
const saltRounds = 10;

console.log('=====================================');
console.log('Generating Bcrypt Hash');
console.log('=====================================');
console.log('Password:', password);
console.log('Salt Rounds:', saltRounds);
console.log('=====================================');

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('[ERROR] Error generating hash:', err);
        process.exit(1);
    }
    
    console.log('[SUCCESS] Bcrypt Hash Generated:');
    console.log('');
    console.log(hash);
    console.log('');
    console.log('=====================================');
    console.log('SQL INSERT Example:');
    console.log('=====================================');
    console.log(`INSERT INTO "user" (id, email, password, "userType", "isVerified", "isActive", "createdAt")`);
    console.log(`VALUES (`);
    console.log(`    gen_random_uuid(),`);
    console.log(`    'admin@khor.com',`);
    console.log(`    '${hash}',`);
    console.log(`    'admin',`);
    console.log(`    true,`);
    console.log(`    true,`);
    console.log(`    NOW()`);
    console.log(`);`);
    console.log('=====================================');
});
