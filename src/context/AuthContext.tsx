import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase/config';
import { getUserRoleAndProfile, logoutUser, type UserProfile, type UserRole } from '../lib/firebase/auth';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  isEmailVerified: boolean;
  isSuspended: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: 'client',
  loading: true,
  isEmailVerified: false,
  isSuspended: false,
  logout: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('client');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const { role: fetchedRole, profile: fetchedProfile } = await getUserRoleAndProfile(currentUser);
          setRole(fetchedRole);
          setProfile(fetchedProfile);
        } catch (err) {
          console.error("Failed to load user profile", err);
        }
      } else {
        setProfile(null);
        setRole('client');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isEmailVerified = user ? user.emailVerified : false;
  const isSuspended = profile ? profile.status === 'suspended' || profile.status === 'deactivated' || profile.status === 'deleted' || profile.status === 'archived' : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        isEmailVerified,
        isSuspended,
        logout: logoutUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
