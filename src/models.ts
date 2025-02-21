import { ObjectId, Db, Collection } from 'mongodb';

// Modèle pour les utilisateurs
export interface User {
    _id?: ObjectId; // Généré automatiquement
    username: string;
    email: string;
    password: string; // Stocké sous forme de hachage
    role?: 'user' | 'admin'; // Par défaut: 'user'
    created_at?: Date; // Par défaut: Date.now
}

  // Modèle pour les object
export interface Object {
    _id?: ObjectId;
    created_by: ObjectId; // Référence à l'ID d'un utilisateur
    type?: 'found' | 'lost';
    title: string;
    description?: string;
    photo_url: string
    contact_info: string
    latitude: number;
    longitude: number;
    created_at?: Date; // Par défaut: Date.now
    updated_at?: Date;
}

  // Modèle pour les object trouvées par leur proprios
export interface FoundObject {
  _id?: ObjectId;
  cache_id: ObjectId; // Référence à l'ID d'un object
  user_id: ObjectId; // Référence à l'ID d'un utilisateur
  found_at?: Date; // Par défaut: Date.now
}
  // Modèle pour les tokens invalidés
export interface BlacklistedToken {
  _id?: ObjectId;
  token: string;
  expires_at?: Date;
}
