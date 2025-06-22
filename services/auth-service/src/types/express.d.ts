declare global {
  namespace Express {
    // Allow any properties on user
    interface User {
      [key: string]: any;
    }

    interface Request {
      user?: any;
    }
  }
}