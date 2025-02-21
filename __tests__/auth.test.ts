import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { app } from '../src/server'; // Assure-toi que ton app est exportée dans un fichier séparé

let mongoServer: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    client = new MongoClient(uri);
    await client.connect();

    process.env.MONGO_URI = uri; // On configure MONGO_URI pour les tests
    process.env.JWT_SECRET = 'test-secret'; // On configure une clé JWT pour les tests
});

afterAll(async () => {
    await client.close();
    await mongoServer.stop();
});

describe('Auth API', () => {
    it('should register a new user', async () => {
        const res = await request(app)
        .post('/auth/register')
        .send({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
        });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Utilisateur créé');
        expect(res.body).toHaveProperty('userId');
    });

    it('should not register a user with an existing email', async () => {
        // Register the first user
        await request(app).post('/auth/register').send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        });

    // Try to register with the same email
        const res = await request(app).post('/auth/register').send({
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password456',
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Cet email est déjà utilisé.');
    });

    it('should login with correct credentials', async () => {
        // Register a user
        await request(app).post('/auth/register').send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        });

        // Login with the same credentials
        const res = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
        });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    it('should not login with incorrect credentials', async () => {
        const res = await request(app).post('/auth/login').send({
        email: 'wrong@example.com',
        password: 'wrongpassword',
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email ou mot de passe incorrect.');
    });
});
