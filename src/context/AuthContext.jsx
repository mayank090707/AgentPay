import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState({
    name: 'Alex',
    email: 'alex@agentpay.io',
    avatar: 'A',
    role: 'Agent Owner'
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const login = (email, password) => {
    setUser({
      name: email.split('@')[0] || 'Alex',
      email: email,
      avatar: (email[0] || 'A').toUpperCase(),
      role: 'Agent Owner'
    });
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
