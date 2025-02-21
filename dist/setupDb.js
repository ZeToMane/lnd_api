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
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
// URI MongoDB
const mongoURI = "mongodb://localhost:27017"; // Change si nécessaire
const dbName = "geocaching_app"; // Nom de la base de données
// Configuration du client MongoDB
const client = new mongodb_1.MongoClient(mongoURI);
function setupDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Connexion au client MongoDB
            yield client.connect();
            console.log("Connecté à MongoDB");
            // Accéder à la base de données
            const db = client.db(dbName);
            // 1. Créer la collection `users` avec un schéma de validation
            yield db.createCollection("users", {
                validator: {
                    $jsonSchema: {
                        bsonType: "object",
                        required: ["username", "email", "password", "role", "created_at"],
                        properties: {
                            username: {
                                bsonType: "string",
                                description: "doit être une chaîne unique et est requis"
                            },
                            email: {
                                bsonType: "string",
                                pattern: "^.+@.+\\..+$",
                                description: "doit être un email valide et est requis"
                            },
                            password: {
                                bsonType: "string",
                                description: "doit être une chaîne de caractères et est requis"
                            },
                            role: {
                                enum: ["user", "admin"],
                                description: "doit être soit 'user', soit 'admin'"
                            },
                            created_at: {
                                bsonType: "date",
                                description: "doit être une date et est requis"
                            }
                        }
                    }
                }
            });
            console.log("Collection `users` créée avec succès.");
            // 2. Créer la collection `caches` avec un schéma de validation
            yield db.createCollection("caches", {
                validator: {
                    $jsonSchema: {
                        bsonType: "object",
                        required: ["title", "latitude", "longitude", "created_by", "created_at"],
                        properties: {
                            title: {
                                bsonType: "string",
                                description: "doit être une chaîne de caractères et est requis"
                            },
                            description: {
                                bsonType: "string",
                                description: "doit être une chaîne de caractères"
                            },
                            latitude: {
                                bsonType: "double",
                                description: "doit être un nombre (latitude) et est requis"
                            },
                            longitude: {
                                bsonType: "double",
                                description: "doit être un nombre (longitude) et est requis"
                            },
                            created_by: {
                                bsonType: "objectId",
                                description: "doit être un ObjectId valide et est requis"
                            },
                            created_at: {
                                bsonType: "date",
                                description: "doit être une date et est requis"
                            }
                        }
                    }
                }
            });
            console.log("Collection `caches` créée avec succès.");
            // 3. Créer la collection `found_caches` avec un schéma de validation
            yield db.createCollection("found_caches", {
                validator: {
                    $jsonSchema: {
                        bsonType: "object",
                        required: ["cache_id", "user_id", "found_at"],
                        properties: {
                            cache_id: {
                                bsonType: "objectId",
                                description: "doit être un ObjectId valide et est requis"
                            },
                            user_id: {
                                bsonType: "objectId",
                                description: "doit être un ObjectId valide et est requis"
                            },
                            found_at: {
                                bsonType: "date",
                                description: "doit être une date et est requis"
                            }
                        }
                    }
                }
            });
            console.log("Collection `found_caches` créée avec succès.");
            // 4. Insérer des documents d'exemple
            // Exemple d'utilisateur
            const usersCollection = db.collection("users");
            const userId = (yield usersCollection.insertOne({
                username: "john_doe",
                email: "john@example.com",
                password: "hashed_password_example",
                role: "user",
                created_at: new Date()
            })).insertedId;
            console.log("Exemple d'utilisateur inséré avec l'ID :", userId);
            // Exemple de cache
            const cachesCollection = db.collection("caches");
            const cacheId = (yield cachesCollection.insertOne({
                title: "Cache au parc",
                description: "Une cache bien cachée sous un banc.",
                latitude: 48.8566,
                longitude: 2.3522,
                created_by: userId,
                created_at: new Date()
            })).insertedId;
            console.log("Exemple de cache inséré avec l'ID :", cacheId);
            // Exemple de cache trouvée
            const foundCachesCollection = db.collection("found_caches");
            const foundCacheId = (yield foundCachesCollection.insertOne({
                cache_id: cacheId,
                user_id: userId,
                found_at: new Date()
            })).insertedId;
            console.log("Exemple de cache trouvée inséré avec l'ID :", foundCacheId);
        }
        catch (err) {
            console.error("Erreur lors de la configuration de la base de données :", err);
        }
        finally {
            // Fermer la connexion
            yield client.close();
            console.log("Connexion à MongoDB fermée.");
        }
    });
}
setupDatabase();
