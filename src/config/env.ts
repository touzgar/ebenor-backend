/**
 * Environment variable helper with type safety
 */
export const env = {
  // Server
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  PORT: process.env['PORT'] || '5000',
  FRONTEND_URL: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  
  // Database
  MONGODB_URI: process.env['MONGODB_URI'] || 'mongodb://localhost:27017/ebenor-creation',
  
  // JWT
  JWT_SECRET: process.env['JWT_SECRET'] || 'fallback-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '7d',
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env['CLOUDINARY_CLOUD_NAME'] || '',
  CLOUDINARY_API_KEY: process.env['CLOUDINARY_API_KEY'] || '',
  CLOUDINARY_API_SECRET: process.env['CLOUDINARY_API_SECRET'] || '',
  
  // UploadThing
  UPLOADTHING_TOKEN: process.env['UPLOADTHING_TOKEN'] || '',
  UPLOADTHING_APP_ID: process.env['UPLOADTHING_APP_ID'] || '',
  UPLOADTHING_SECRET: process.env['UPLOADTHING_SECRET'] || '',
  
  // Email
  SMTP_HOST: process.env['SMTP_HOST'] || 'smtp.gmail.com',
  SMTP_PORT: process.env['SMTP_PORT'] || '587',
  SMTP_USER: process.env['SMTP_USER'] || '',
  SMTP_PASS: process.env['SMTP_PASS'] || '',
  FROM_EMAIL: process.env['FROM_EMAIL'] || 'noreply@ebenor-creation.com',
  ADMIN_EMAIL: process.env['ADMIN_EMAIL'] || 'admin@ebenor-creation.com',
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env['BCRYPT_ROUNDS'] || '12'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  
  // Logging
  LOG_LEVEL: process.env['LOG_LEVEL'] || 'info',
  LOG_FILE_PATH: process.env['LOG_FILE_PATH'] || './logs',
  
  // Other
  WHATSAPP_NUMBER: process.env['WHATSAPP_NUMBER'] || '+21670123456',
};
