import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null; } | null; error: unknown | null; }>;
  signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null; } | null; error: unknown | null; }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  verifyEmail: (email: string) => Promise<void>;
  deleteUser: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      // First, check if the user already exists
      const { data: existingUser, error: checkError } = await supabase.auth.signInWithPassword({
        email,
        password: 'temporary-password', // This will fail but tell us if the user exists
      });

      // If the error is not "Invalid login credentials", there might be another issue
      if (checkError && !checkError.message.includes('Invalid login credentials')) {
        console.error('Error checking user existence:', checkError);
        return { data: null, error: checkError };
      }

      // If the user exists but email is not confirmed, try to resend confirmation
      if (existingUser?.user && !existingUser.user.email_confirmed_at) {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (resendError) {
          console.error('Error resending confirmation email:', resendError);
          return { data: null, error: resendError };
        }

        // Return success with the existing user
        return { data: existingUser, error: null };
      }

      // If the user exists and email is confirmed, return error
      if (existingUser?.user && existingUser.user.email_confirmed_at) {
        return { 
          data: null, 
          error: new Error('User already exists with this email. Please sign in instead.') 
        };
      }

      // If we get here, the user doesn't exist, so create a new account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            email_confirmed: false
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const verifyEmail = async (email: string) => {
    try {
      // First try to sign up again to trigger a new verification email
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: 'temporary-password', // This will fail but trigger a new verification email
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        // If signup fails, try resending the verification email
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (resendError) {
          console.error('Error resending verification email:', resendError);
          throw resendError;
        }
      }
    } catch (error) {
      console.error('Error in verifyEmail:', error);
      throw error;
    }
  };

  const deleteUser = async (email: string) => {
    try {
      // First, sign in as the user to get their session
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'temporary-password', // This will fail but give us the user
      });

      if (signInError) {
        console.error('Error signing in:', signInError);
        throw new Error('Failed to delete user');
      }

      if (user) {
        // Delete the user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error('Error deleting user:', deleteError);
          throw new Error('Failed to delete user');
        }
      }
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    verifyEmail,
    deleteUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 