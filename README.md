# Stitch Store

![React](https://img.shields.io/badge/React-v18.x-blue) ![Node.js](https://img.shields.io/badge/Node.js-v18.x-green) ![Express](https://img.shields.io/badge/Express-v4.x-blue) ![License](https://img.shields.io/badge/License-ISC-yellow)

**Stitch Store** is a full-stack e-commerce platform built to sell bags, wallets etc. It features a responsive React.js frontend for an intuitive user experience and a Node.js/Express backend with RESTful APIs, integrated with Shiprocket for shipping and Razorpay for secure payments.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Features
- **Product Catalog**: Browse and filter a collection of bags.
- **Order Management**: Create and track orders with real-time shipping updates via Shiprocket.
- **Payment Gateway**: Secure checkout using Razorpay integration.
- **Responsive Design**: Seamless experience on desktop and mobile devices.
- **Scalable APIs**: RESTful backend services for efficient data handling.

## Tech Stack
### Frontend
- **React.js**: Library for building dynamic UI components.
- **JavaScript (ES6+)**: Core language for frontend development.

### Backend
- **Node.js**: Runtime for server-side logic.
- **Express.js**: Framework for RESTful API development.
- **Shiprocket API**: Shipping and logistics integration.
- **Razorpay API**: Payment processing integration.

## Project Structure
```
stitch_store/
├── backend/             # Backend source code
│   ├── routes/          # API route definitions
│   ├── controllers/     # Business logic for endpoints
│   ├── models/          # Data models (if applicable)
│   ├── .env             # Environment variables (not tracked)
│   └── package.json     # Backend dependencies
├── frontend/            # Frontend source code
│   ├── src/             # React components, pages, and logic
│   ├── public/          # Static assets
│   └── package.json     # Frontend dependencies
└── README.md            # Project documentation
```

## Installation

### Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- Shiprocket and Razorpay API keys (sign up at [Shiprocket](https://www.shiprocket.in/) and [Razorpay](https://razorpay.com/))

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/nikhilmehra14/stitch_store.git
   cd stitch_store
2. **Set up the Backend**:
   ```bash
   cd backend
   npm install
- Create a .env file in backend.
- Start the backend:
  ```bash
  npm run dev  # Development mode with nodemon
  npm start    # Production mode
3. **Set up the Frontend**:
   ```bash
   cd ../frontend
   npm install
   npm start
4. **Access the Application**: [Features](#features)
- [Backend API](http://localhost:8000) (default port: 8000)
- [Frontend](http://localhost:5173)

5. **Environment Variables**
- Backend (backend/.env):
  ```bash
  PORT=8000
  CORS_ORIGIN=
  NODE_ENV=
  ACCESS_TOKEN_SECRET=
  ACCESS_TOKEN_EXPIRY=1d
  REFRESH_TOKEN_SECRET=
  REFRESH_TOKEN_EXPIRY=10d
  DB_NAME= DB_URI= 
  DB_PASSWORD= 
  RAZORPAY_KEY_ID= 
  RAZORPAY_KEY_SECRET= 
  GOOGLE_CLIENT_ID= 
  GOOGLE_CLIENT_SECRET= 
  GOOGLE_CALLBACK_URL=
  REDIS_URL=
  OTP_EXPIRATION= 
  BASE_URL=
  FRONTEND_URL=
  EMAIL=
  EMAIL_NOREPLY=
  EMAIL_SUPPORT=
  EMAIL_PASSWORD= 
  TWILIO_PHONE_NUMBER= 
  OTP_EXPIRY= 
  ENCRYPTION_KEY= 
  ENCRYPTION_IV= 
  SHIPROCKET_EMAIL= 
  SHIPROCKET_PASSWORD= 
  SHIPROCKET_BASE_URL=
  CLOUDINARY_CLOUD_NAME= 
  CLOUDINARY_API_KEY= 
  CLOUDINARY_API_SECRET=

- Frontend (frontend/.env)
  ```bash
   REACT_APP_API_URL=http://localhost:8000/api

- PORT: Backend server port.
- NODE_ENV: Set to development or production.
- RAZORPAY_*: Credentials from Razorpay dashboard.
- SHIPROCKET_*: Credentials from Shiprocket dashboard.
- REACT_APP_API_URL: Base URL for backend API calls.

## Contributing
- Fork the repository.
- Create a feature branch (git checkout -b feature/your-feature).
- Commit your changes (git commit -m "Add your feature").
- Push to the branch (git push origin feature/your-feature).
- Open a Pull Request.

## License
This project is licensed under the ISC License - see the  file for details.
