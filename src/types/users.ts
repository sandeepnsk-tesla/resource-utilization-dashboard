/**
 * Types for the multi-user project registry system.
 * Each user has a JSON file listing their project GDrive sheet links.
 */

/** A single project entry in a user's JSON config */
export interface UserProject {
  name: string;
  month: string;
  year: number;
  sheetUrl: string;
}

/** A user's full project configuration (from their JSON file) */
export interface UserConfig {
  name: string;
  projects: UserProject[];
}

/** An entry in the registry listing all users */
export interface UserRegistryEntry {
  id: string;
  name: string;
  file: string; // filename relative to /users/ folder
}

/** The registry file structure */
export interface UserRegistry {
  users: UserRegistryEntry[];
}

/** Status of loading a user's data */
export type UserDataStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Cached user data state */
export interface UserDataState {
  status: UserDataStatus;
  config: UserConfig | null;
  error: string | null;
}
