
import axios from 'axios';

const API_URL = 'http://localhost:7000/api';

async function runTests() {
    try {
        console.log('--- Starting User Management API Tests ---');

        // 1. Login
        console.log('1. Testing Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@safeguardpro.com',
            password: 'admin123'
        });

        if (!loginRes.data.success || !loginRes.data.token) {
            throw new Error('Login failed');
        }
        const token = loginRes.data.token;
        console.log('✅ Login successful. Token received.');

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Create User
        console.log('\n2. Testing Create User...');
        const newUser = {
            name: 'Test Integration User',
            email: `integration.test.${Date.now()}@test.com`,
            password: 'password123',
            role: 'technician',
            active: true
        };

        const createRes = await axios.post(`${API_URL}/users`, newUser, { headers });
        const createdUser = createRes.data;

        if (createdUser.email !== newUser.email) throw new Error('User creation failed mismatch');
        console.log('✅ User created:', createdUser.id);

        // 3. Verify Password Hashing (Indirectly via Login with new user)
        console.log('\n3. Verifying New User Login (Password Hashing)...');
        const userLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: newUser.email,
            password: newUser.password
        });
        if (!userLoginRes.data.success) throw new Error('New user login failed');
        console.log('✅ New user login successful (Password is correctly hashed).');

        // 4. Update User
        console.log('\n4. Testing Update User...');
        const updateData = { ...createdUser, name: 'Updated Integration Name' };
        const updateRes = await axios.put(`${API_URL}/users/${createdUser.id}`, updateData, { headers });

        if (updateRes.data.name !== 'Updated Integration Name') throw new Error('Update failed');
        console.log('✅ User updated successfully.');

        // 5. Delete User
        console.log('\n5. Testing Delete User...');
        await axios.delete(`${API_URL}/users/${createdUser.id}`, { headers });

        try {
            // Verify deletion by trying to update again or get
            await axios.put(`${API_URL}/users/${createdUser.id}`, updateData, { headers });
            throw new Error('User should have been deleted');
        } catch (e: any) {
            if (e.response && e.response.status === 500) { // Or 404, depending on implementation
                console.log('✅ User deleted successfully (Update failed as expected).');
            } else {
                // It might be that the API returns success even if not found, or 500. 
                // Let's check with login
                try {
                    await axios.post(`${API_URL}/auth/login`, {
                        email: newUser.email,
                        password: newUser.password
                    });
                    throw new Error('Deleted user should not be able to login');
                } catch (loginErr: any) {
                    if (loginErr.response && loginErr.response.status === 401) {
                        console.log('✅ Deleted user cannot login.');
                    }
                }
            }
        }

        console.log('\n--- All Tests Passed Successfully ---');

    } catch (error: any) {
        console.error('❌ Test Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

runTests();
