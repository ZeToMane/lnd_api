"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const app = (0, express_1.default)();
const PORT = 3000;
// URI de connexion à MongoDB
const mongoURI = 'mongodb://localhost:27017';
const dbName = 'nomDeLaBDD'; // BDD
const collectionName = 'nomDeLaCollection'; // Nom de collection
let db; // Type db
// Configuration et connexion au client MongoDB
const client = new mongodb_1.MongoClient(mongoURI);
client.connect()
    .then(() => {
    console.log('Connecté à MongoDB');
    db = client.db(dbName); // Assigner la base de données après connexion
    // Démarrer le serveur après la connexion
    app.listen(PORT, () => {
        console.log(`Serveur en écoute sur le port ${PORT}`);
    });
})
    .catch((err) => {
    console.error('Erreur de connexion à MongoDB :', err);
    process.exit(1); // Arrêter l'application en cas d'échec critique
});
// Middleware pour parser le JSON
app.use(express_1.default.json());
// Route pour récupérer tous les documents de la collection
app.get('/posts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!db) {
            throw new Error('Connexion à la base de données non établie.');
        }
        const collection = db.collection(collectionName); // Accéder à la collection
        const posts = yield collection.find({}).toArray(); // Récupérer tous les documents
        res.status(200).json(posts); // Envoyer les documents en réponse
    }
    catch (err) {
        console.error('Erreur lors de la récupération des données :', err);
        res.status(500).json({ message: 'Erreur lors de la récupération des données.' });
    }
}));
