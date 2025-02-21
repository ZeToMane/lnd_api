import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import multer from 'multer'
import sharp from 'sharp'
import SwaggerUI from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc'
import { User, Object, BlacklistedToken} from './models';
import { MongoClient, ObjectId, Db, Collection } from 'mongodb';
import { Request, Response, NextFunction } from 'express';

// Étendre l'interface Request pour inclure la propriété `user`
declare module 'express' {
    interface Request {
        user?: Pick<User, '_id' | 'email' | 'username'>;
    }
}

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'LND API',
            version: '1.0.0',
            description: 'API Documentation for LND Application',
        },
        servers: [
            {
            url: 'http://localhost:3000', // Adjust the URL as needed
            description: 'Local development server',
            },
        ],
    },
    // Path to the API docs. You can include paths to your routes files.
    apis: [path.join(__dirname, 'server.*')], // or use "./routes/*.ts" if that's where your endpoints are
}

  // Generate the swagger spec
const swaggerSpec = swaggerJsdoc(swaggerOptions)
console.log(JSON.stringify(swaggerSpec, null, 2))

dotenv.config();

export const app = express();
const PORT = process.env.PORT;
const mongoURI = process.env.MONGO_URI!;
const jwtSecret = process.env.JWT_SECRET!;

const port = parseInt(process.env.PORT, 10)

const upload = multer({ dest: 'uploads/' })

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

console.log('swaggerUi.serve type:', typeof SwaggerUI.serve);
console.log('swaggerUi.setup type:', typeof SwaggerUI.setup);
console.log("swaggerSpec: ", swaggerSpec)


app.use(cookieParser());

const corsOptions = {
    //origin: 'http://localhost:3001', // Replace with your actual frontend URL
    origin: 'https://lnd-frontend.vercel.app',
    credentials: true, // Allow credentials (cookies)
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

/* app.get('/api-docs', (req, res) => {
    res.redirect('/api-docs/');
}); */
app.use('/docs', SwaggerUI.serve, SwaggerUI.setup(swaggerSpec))

// Connexion à MongoDB
let db: Db;
const client = new MongoClient(mongoURI);

async function connectToDatabase() {
    if (!db) {
        await client.connect();
        console.log("Connecté à MongoDB");
        db = client.db("lnd_app");
    }
    return db;
}

const deleteFile = async (filePath: string) => {
    try {
        await fs.promises.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
    } catch (err) {
        console.error(`Error deleting file ${filePath}:`, err);
    }
};

// Middleware d'authentification avec JWT
const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.header('Authorization') || req.cookies.token;
    if (!token) {
        res.status(401).json({ message: 'Accès refusé' });
        console.log("My cookie token", req.cookies.token);
        return
    }

    try {
        // 1. Check if token is blacklisted
        const database = await connectToDatabase();
        const blacklistCollection: Collection<BlacklistedToken> = database.collection("token_blacklist");

        const blacklistedToken = await blacklistCollection.findOne({ token });
        if (blacklistedToken) {
            res.status(401).json({ message: 'Token révoqué/blacklisté.' });
            return
        }

         // Vérifier et typer le token
        const decoded = jwt.verify(token, jwtSecret);

        // Vérification explicite du type
        if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded && 'email' in decoded && 'name' in decoded) {
            //req.user = decoded as { userId: string; email: string };

            req.user = {
                username: decoded.name,
                _id: decoded.userId, // Renomme correctement pour qu'il corresponde à `req.user._id`
                email: decoded.email
            };

            console.log("Utilisateur authentifié:", req.user);
            next();
        } else {
            res.status(400).json({ message: 'Token invalide' });
        }
    } catch (err) {
        res.status(400).json({ message: 'Token invalide' });
    }
};

// ============================
// 1. Inscription (POST /auth/register)
// ============================
/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: "Inscription"
 *     description: "Permet de créer un nouvel utilisateur."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "JeanDupont"
 *               email:
 *                 type: string
 *                 example: "jean.dupont@example.com"
 *               password:
 *                 type: string
 *                 example: "motdepasse123"
 *     responses:
 *       "201":
 *         description: "Utilisateur créé avec succès."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       "400":
 *         description: "Email déjà utilisé ou données invalides."
 *       "500":
 *         description: "Erreur serveur."
 */
app.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
    const { username, email, password } = req.body;
    const database = await connectToDatabase();
    const usersCollection: Collection<User> = database.collection("users");

    try {
        // Vérifier si l'utilisateur existe déjà
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "Cet email est déjà utilisé." });
            return 
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insérer l'utilisateur
        const newUser: User = {
            username,
            email,
            password: hashedPassword,
            role: "user",
            created_at: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "Utilisateur créé", userId: result.insertedId });
    } catch (err) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// ============================
// 2. Connexion (POST /auth/login)
// ============================
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: "Connexion"
 *     description: "Authentifie un utilisateur existant."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "jean.dupont@example.com"
 *               password:
 *                 type: string
 *                 example: "motdepasse123"
 *     responses:
 *       "200":
 *         description: "Connexion réussie, retourne un token JWT."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       "400":
 *         description: "Email ou mot de passe incorrect."
 *       "500":
 *         description: "Erreur serveur."
 */
app.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const database = await connectToDatabase();
    const usersCollection: Collection<User> = database.collection("users");

    const token = req.cookies.token;
    if(token){
        const decoded = jwt.verify(token, jwtSecret);

        let expires_at;
        if (typeof decoded === 'object' && decoded.exp) {
            expires_at = new Date(decoded.exp * 1000);
            console.log("Decoded token:", decoded);
        } else {
            expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        }

        const blacklistCollection: Collection<BlacklistedToken> = database.collection("token_blacklist");

        // Store the token in the blacklist
        await blacklistCollection.insertOne({
            token,
            expires_at,
        });

        // Effacer le cookie du côté client
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // seulement en HTTPS en production
            sameSite: 'lax', // ou 'strict' selon vos besoins
        });

        /* res.status(200).json({ message: "Utilisateur déja connecté, blacklist le token et créer un nouveau après" }); */
    }

    try {
        // Vérifier si l'utilisateur existe
        const user = await usersCollection.findOne({ email });
        if (!user) {
            res.status(400).json({ message: "Email ou mot de passe incorrect." });
            return 
        }

        // Vérifier le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(400).json({ message: "Email ou mot de passe incorrect." });
            return
        }

        // Générer un token JWT
        const token = jwt.sign({ name: user.username, userId: user._id, email: user.email }, jwtSecret, { expiresIn: "1h" });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // seulement en HTTPS en prod
            sameSite: 'lax', // ou 'strict' selon vos besoins
            maxAge: 3600000 // 1 heure
        });

        res.status(200).json({ token });
    } catch (err) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// ============================
// 3. Déconnexion (POST /auth/logout)
// ============================
/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: "Déconnexion"
 *     description: "Déconnecte l'utilisateur en blacklistant le token et en supprimant le cookie."
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: "Déconnexion réussie."
 *       "400":
 *         description: "Token non fourni ou invalide."
 */
app.post('/auth/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
    const token = req.header('Authorization') || req.cookies.token;

    if (!token) {
        res.status(400).json({ message: 'Token non fourni' });
        return
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);

        // Optionally, parse the "exp" from the token if you want to store expiry
        let expires_at;
        if (typeof decoded === 'object' && decoded.exp) {
            // 'exp' is usually the number of seconds since epoch
            // Convert it to milliseconds for Date constructor
            expires_at = new Date(decoded.exp * 1000);
            console.log("Decoded token:", decoded);
        } else {
            // If no "exp" was set, or you'd rather just set your own
            expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        }

        const database = await connectToDatabase();
        const blacklistCollection: Collection<BlacklistedToken> = database.collection("token_blacklist");

        // Store the token in the blacklist
        await blacklistCollection.insertOne({
            token,
            expires_at,
        });

        // Effacer le cookie du côté client
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // seulement en HTTPS en production
            sameSite: 'lax', // ou 'strict' selon vos besoins
        });

        res.status(200).json({ message: "Déconnecté avec succès." });
        return
    } catch (err) {
        res.status(400).json({ message: 'Token invalide' });
        return
    }
});


/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: "Informations utilisateur"
 *     description: "Retourne les informations de l'utilisateur authentifié."
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: "Informations de l'utilisateur retournées."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 email:
 *                   type: string
 *       "401":
 *         description: "Non authentifié."
 */
app.get('/auth/me', authenticate, async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
        res.status(401).json({ message: 'Non authentifié' });
        return
    }

    try {
        // Return the minimal user data you need
        res.status(200).json({
            name: req.user?.username,
            userId: req.user?._id,
            email: req.user?.email
        });
    } catch (err) {
        res.status(401).json({ message: 'Token invalide' });
    }
});


// ============================
// 4. Récupérer tous les objects (GET /objets)
// ============================
/**
 * @openapi
 * /objects:
 *   get:
 *     summary: "Récupérer tous les objets"
 *     description: "Retourne la liste de tous les objets."
 *     responses:
 *       "200":
 *         description: "Liste d'objets."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Object'
 *       "500":
 *         description: "Erreur serveur."
 *   post:
 *     summary: "Créer un objet"
 *     description: "Permet de créer un nouvel objet (authentification requise)."
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - description
 *               - contact_info
 *               - latitude
 *               - longitude
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [found, lost]
 *               title:
 *                 type: string
 *                 example: "Portefeuille"
 *               description:
 *                 type: string
 *                 example: "Portefeuille noir en cuir"
 *               contact_info:
 *                 type: string
 *                 example: "@instagram"
 *               latitude:
 *                 type: number
 *                 example: 48.8566
 *               longitude:
 *                 type: number
 *                 example: 2.3522
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       "201":
 *         description: "Objet créé avec succès."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 objectId:
 *                   type: string
 *       "401":
 *         description: "Non authentifié."
 *       "500":
 *         description: "Erreur serveur."
 */
app.get('/objects', async (req: Request, res: Response): Promise<void> => {
    const database = await connectToDatabase();
    const objectsCollection: Collection<Object> = database.collection("object");

    try{
        const objects = await objectsCollection.find({}).toArray();
        res.status(200).json(objects)
    } catch (err){
        res.status(500).json({ message: "Erreur serveur" })
    }
});

// ============================
// 5. Récupérer object par id (GET /objets/:id)
// ============================

/**
 * @openapi
 * /objects/{id}:
 *   get:
 *     summary: "Récupérer un objet par ID"
 *     description: "Retourne les détails d'un objet identifié par son ID."
 *     parameters:
 *       - name: id
 *         in: path
 *         description: "ID de l'objet"
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: "Détails de l'objet."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Object'
 *       "400":
 *         description: "ID invalide."
 *       "404":
 *         description: "Objet non trouvé."
 *       "500":
 *         description: "Erreur serveur."
 */

app.get('/objects/:id', async (req: Request, res: Response): Promise<void> => {
    const database = await connectToDatabase();
    const objectsCollection: Collection<Object> = database.collection("object");

    try{
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            console.log("❌ L'ID n'est pas valide !");
            res.status(400).json({ message: "ID de object invalide." });
            return
        }

        const objectId = new ObjectId(id);
        console.log("ID converti en ObjectId:", objectId);

        const object = await objectsCollection.findOne({ _id: objectId });

        if (!object) {
            console.log("❌ Aucune object trouvée avec cet ID :", objectId);
            res.status(404).json({ message: "Object non trouvée." });
            return
        }

        console.log("✅ Object trouvée :", object);

        res.status(200).json(object)
    } catch (err){
        res.status(500).json({ message: "Erreur serveur" })
    }
});

// ============================
// 6. Récupérer object par user id (GET user/objets/)
// ============================

/**
 * @openapi
 * /user/objects/:
 *   get:
 *     summary: "Récupérer les objets d'un utilisateur"
 *     description: "Retourne les objets créés par l'utilisateur authentifié."
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: "Liste des objets de l'utilisateur."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Object'
 *       "401":
 *         description: "Non authentifié."
 *       "404":
 *         description: "Aucun objet trouvé."
 *       "500":
 *         description: "Erreur serveur."
 */

app.get('/user/objects/', authenticate, async (req: Request, res: Response): Promise<void> => {
    const database = await connectToDatabase();
    const objectsCollection: Collection<Object> = database.collection("object");

    try{
        const userId = new ObjectId(req.user?._id);

        console.log("User ID converti en ObjectId:", userId);

        const objects = await objectsCollection.find({ created_by: userId }).toArray();

        if (!objects) {
            console.log("❌ Aucun objects trouvée avec cet User ID :", userId);
            res.status(404).json({ message: "Objects non trouvée." });
            return
        }

        console.log("✅ Objects trouvée :", objects);

        res.status(200).json(objects)
    } catch (err){
        res.status(500).json({ message: "Erreur serveur" })
    }
});

// ============================
// 7. Créer un object (POST /objects) [Authentification requise]
// ============================

/* app.post('/objects', authenticate, async (req: Request, res: Response): Promise<void> => {
    const { type, title, description, photo_url, contact_info, latitude, longitude} = req.body;
    const database = await connectToDatabase();
    const objectCollection: Collection<Object> = database.collection("object");

    try {
        const newObject: Object = {
            created_by: new ObjectId(req.user?._id),
            type,
            title,
            description,
            photo_url,
            contact_info,
            latitude,
            longitude,
            created_at: new Date(),
            updated_at: new Date(),
        };

        console.log("mon user id: ", req.user?._id);

        const result = await objectCollection.insertOne(newObject);
        res.status(201).json({ message: "Object ajoutée", objectId: result.insertedId });
    } catch (err) {
        res.status(500).json({ message: "Erreur serveur" });
    }
}); */

app.post('/objects', authenticate, upload.single('photo'), async (req: Request, res: Response): Promise<void> => {
    const { type, title, description, contact_info, latitude, longitude } = req.body
    const database = await connectToDatabase()
    const objectCollection: Collection<Object> = database.collection("object")

    try {
        let photo_url = ''
        if (req.file) {
            // Use sharp to compress and convert the image as needed
            const outputFilePath = `uploads/compressed-${Date.now()}-${req.file.originalname}`
            await sharp(req.file.path)
                .resize(800) // for example, resize width to 800px
                .toFormat('jpeg')
                .jpeg({ quality: 80 })
                .toFile(outputFilePath)

            // Optionally, delete the original file here if desired
            // Delete the temporary file that Multer stored
            try {
                await fs.promises.unlink(req.file.path);
                console.log(`Temporary file ${req.file.path} deleted.`);
            } catch (err) {
                console.error(`Error deleting temporary file ${req.file.path}:`, err);
            }


            // Set the photo_url (could be a full URL or relative path)
            photo_url = outputFilePath
        }

        const newObject: Object = {
            created_by: new ObjectId(req.user?._id),
            type,
            title,
            description,
            photo_url,
            contact_info,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            created_at: new Date(),
            updated_at: new Date(),
        }
    
        console.log("User id: ", req.user?._id)
        const result = await objectCollection.insertOne(newObject)
        res.status(201).json({ message: "Object added", objectId: result.insertedId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Server error" })
    }
})

// ============================
// 5. Récupérer object par id (GET /objets/:id)
// ============================

/**
 * @openapi
 * /user/objects/{id}:
 *   delete:
 *     summary: "Supprimer un objet"
 *     description: "Supprime un objet appartenant à l'utilisateur authentifié."
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: "ID de l'objet à supprimer"
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: "Objet supprimé avec succès."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       "400":
 *         description: "ID invalide."
 *       "404":
 *         description: "Objet non trouvé."
 *       "500":
 *         description: "Erreur serveur."
 */
app.delete('/user/objects/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
    const database = await connectToDatabase();
    const objectsCollection: Collection<Object> = database.collection("object");

    try{
        const userId = new ObjectId(req.user?._id);
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            console.log("❌ L'ID n'est pas valide !");
            res.status(400).json({ message: "ID de object invalide." });
            return
        }

        const objectId = new ObjectId(id);
        console.log("ID converti en ObjectId:", objectId);

        const objectToDelete = await objectsCollection.findOne({ _id: objectId, created_by: userId });
        if (!objectToDelete) {
            res.status(404).json({ message: "Objet pas trouvé" });
            return;
        }

        const result = await objectsCollection.deleteOne({ _id: objectId, created_by: userId });

        if(result.deletedCount == 0){
            res.status(404).json({ message: "Objet pas trouvé", result });
        } else{
            if (objectToDelete.photo_url) {
                const filePath = path.join(process.cwd(), objectToDelete.photo_url);
                await deleteFile(filePath);
            }
            res.status(200).json({ message: "Objet delete avec succès.", result });
        }        
    } catch (err){
        res.status(500).json({ message: "Erreur serveur" })
    }
});

// ============================
// 5. Mettre à jour object par id (PUT /objets/:id)
// ============================

/**
 * @openapi
 * /user/objects/update/{id}:
 *   put:
 *     summary: "Mettre à jour un objet"
 *     description: "Met à jour les informations d'un objet appartenant à l'utilisateur authentifié."
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: "ID de l'objet à mettre à jour"
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [found, lost]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               contact_info:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       "200":
 *         description: "Objet mis à jour avec succès."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       "400":
 *         description: "ID invalide."
 *       "404":
 *         description: "Objet non trouvé ou droits insuffisants."
 *       "500":
 *         description: "Erreur serveur."
 */
app.put('/user/objects/update/:id', authenticate, upload.single('photo'), async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Vérifie que l'ID est valide
    if (!ObjectId.isValid(id)) {
        res.status(400).json({ message: "ID invalide." });
        return;
    }
    const objectId = new ObjectId(id);

    // Accède à la base de données et à la collection "object"
    const database = await connectToDatabase();
    const objectsCollection: Collection<Object> = database.collection("object");

    // Récupère les champs à mettre à jour depuis le corps de la requête
    const { type, title, description, /* photo_url, */ contact_info, latitude, longitude } = req.body;

    let photo_url = ''

    if (req.file) {
        const existingObject = await objectsCollection.findOne({ _id: objectId });
        if (existingObject && existingObject.photo_url) {
            // Construct the absolute path to the existing image
            // Adjust the base path as needed (e.g., process.cwd() or __dirname)
            const oldFilePath = path.join(process.cwd(), existingObject.photo_url);
            await deleteFile(oldFilePath);
        }
        // Use sharp to compress and convert the image as needed
        const outputFilePath = `uploads/compressed-${Date.now()}-${req.file.originalname}`
        await sharp(req.file.path)
            .resize(800) // for example, resize width to 800px
            .toFormat('jpeg')
            .jpeg({ quality: 80 })
            .toFile(outputFilePath)

        // Optionally, delete the original file here if desired
        // Delete the temporary file that Multer stored
        try {
            await fs.promises.unlink(req.file.path);
            console.log(`Temporary file ${req.file.path} deleted.`);
        } catch (err) {
            console.error(`Error deleting temporary file ${req.file.path}:`, err);
        }


        // Set the photo_url (could be a full URL or relative path)
        photo_url = outputFilePath
    }

    const latNum = latitude ? parseFloat(latitude) : undefined
    const lonNum = longitude ? parseFloat(longitude) : undefined

    // Prépare les données à mettre à jour
    const updateData: Partial<Object> = {
        ...(type && { type }),
        ...(title && { title }),
        ...(description && { description }),
        ...(photo_url && { photo_url }),
        ...(contact_info && { contact_info }),
        ...(latNum !== undefined && { latitude: latNum }),
        ...(lonNum !== undefined && { longitude: lonNum }),
        updated_at: new Date(), // Met à jour le champ de dernière modification
    };

    try {
        // Met à jour uniquement l'objet appartenant à l'utilisateur authentifié
        const result = await objectsCollection.updateOne(
            { _id: objectId, created_by: new ObjectId(req.user?._id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            res.status(404).json({ message: "Objet non trouvé ou vous n'avez pas les droits pour le mettre à jour." });
            return;
        }

        const objects = await objectsCollection.find({}).toArray();

        res.status(200).json({ message: "Objet mis à jour avec succès.", objects });
    } catch (err) {
        console.error("Update error:", err)
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// Lancer le serveur
app.listen(port, "0.0.0.0", () => {
    console.log(`Serveur en écoute sur http://localhost:${PORT}`);
    console.log(`📄 Swagger Docs: http://localhost:${PORT}/docs`);
});
