# Expense Tracker Application

A comprehensive expense tracking and budgeting application built with Node.js, Express, and modern web technologies.

## Project Structure

```
Expense_Tracker/
├── public/                  # Client-side assets
│   ├── css/                # Stylesheets
│   │   ├── styles.css      # Main styles
│   │   └── login.css       # Login page styles
│   ├── js/                 # JavaScript files
│   │   ├── index.js        # Main application logic
│   │   ├── auth.js         # Authentication handling
│   │   ├── login.js        # Login page logic
│   │   └── reminder.js     # Reminder functionality
│   └── html/               # HTML pages
│       ├── index.html      # Main dashboard
│       ├── login.html      # Login page
│       └── reminder.html   # Reminder page
├── server/                 # Server-side code
│   ├── config/            # Configuration files
│   │   └── .env          # Environment variables
│   ├── routes/           # API routes
│   │   ├── auth.js       # Authentication routes
│   │   ├── budgets.js    # Budget management routes
│   │   ├── expenses.js   # Expense management routes
│   │   └── income.js     # Income management routes
│   ├── models/           # Database models
│   │   ├── User.js       # User model
│   │   ├── Budget.js     # Budget model
│   │   ├── Expense.js    # Expense model
│   │   └── Income.js     # Income model
│   └── server.js         # Main server file
```

## Features

- User Authentication
- Expense Tracking
- Budget Management
- Income Management
- Financial Analytics
- Responsive Dashboard
- Interactive Charts

## Setup Instructions

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd expense-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your configuration

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Access the application:
   - Open `http://localhost:3000` in your browser
   - Login or register to start using the application

## API Endpoints

### Authentication

- POST /api/auth/login - User login
- POST /api/auth/register - User registration
- POST /api/auth/verify-token - Verify JWT token

### Budgets

- GET /api/budgets/:userId - Get all budgets
- POST /api/budgets - Create new budget
- PUT /api/budgets/:id - Update budget
- DELETE /api/budgets/:id - Delete budget

### Expenses

- GET /api/expenses/:userId - Get all expenses
- POST /api/expenses - Create new expense
- PUT /api/expenses/:id - Update expense
- DELETE /api/expenses/:id - Delete expense
- GET /api/expenses/:userId/analytics - Get expense analytics

### Income

- GET /api/income/:userId - Get user's income
- PUT /api/income/:userId - Update user's income

## Technologies Used

- Frontend:

  - HTML5, CSS3, JavaScript
  - Chart.js for data visualization
  - FontAwesome for icons

- Backend:
  - Node.js
  - Express.js
  - MongoDB with Mongoose
  - JWT for authentication

## Development

- Run tests:

  ```bash
  npm test
  ```

- Start development server with auto-reload:
  ```bash
  npm run dev
  ```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.
