import { MongoClient } from "mongodb";

// URI MongoDB
const mongoURI = "mongodb://localhost:27017"; // Change si nécessaire
const dbName = "lnd_app"; // Nom de la base de données

// Configuration du client MongoDB
const client = new MongoClient(mongoURI);

async function setupDatabase() {
    try {
        // Connexion au client MongoDB
        await client.connect();
        console.log("Connecté à MongoDB");

        // Accéder à la base de données
        const db = client.db(dbName);

        // 1. Créer la collection `users` avec un schéma de validation
        await db.createCollection("users", {
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

        // 2. Créer la collection `object` avec un schéma de validation
        await db.createCollection("object", {
            validator: {
                $jsonSchema: {
                bsonType: "object",
                required: ["created_by", "type", "title", "description", "photo_url", "contact_info", "latitude", "longitude", "created_at", "updated_at"],
                properties: {
                    created_by: {
                        bsonType: "objectId",
                        description: "doit être un ObjectId valide et est requis"
                    },
                    type: {
                        bsonType: "string",
                        description: "doit être soit 'found', soit 'lost'"
                    },
                    title: {
                        bsonType: "string",
                        description: "doit être une chaîne de caractères et est requis"
                    },
                    description: {
                        bsonType: "string",
                        description: "doit être une chaîne de caractères"
                    },
                    photo_url: {
                        bsonType: "string",
                        description: "doit être une chaîne de caractères"
                    },
                    contact_info: {
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
                    created_at: {
                        bsonType: "date",
                        description: "doit être une date et est requis"
                    },
                    updated_at: {
                        bsonType: "date",
                        description: "doit être une date et est requis"
                    }
                }
                }
            }
        });
        console.log("Collection `object` créée avec succès.");

        // 3. Créer la collection `found_object` avec un schéma de validation
        await db.createCollection("found_object", {
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
        console.log("Collection `found_object` créée avec succès.");

        // 3. Créer la collection `token_blacklist` avec un schéma de validation
        await db.createCollection("token_blacklist", {
            validator: {
                $jsonSchema: {
                bsonType: "object",
                required: ["token", "expires_at"],
                properties: {
                    token: {
                        bsonType: "string",
                        description: "doit être une chaîne de caractères valide et est requis"
                    },
                    expires_at: {
                        bsonType: "date",
                        description: "doit être une date et est requis"
                    }
                }
                }
            }
        });
        console.log("Collection `token_blacklist` créée avec succès.");

        // Création de l’index TTL
        await db.collection("token_blacklist").createIndex(
            { expires_at: 1 },
            { expireAfterSeconds: 0 } // Supprime automatiquement le document dès que expires_at est dépassé
        );
        console.log("Index TTL pour la collection `token_blacklist` créé avec succès.");

    } catch (err) {
        console.error("Erreur lors de la configuration de la base de données :", err);
    } finally {
        // Fermer la connexion
        await client.close();
        console.log("Connexion à MongoDB fermée.");
    }
}

setupDatabase();
