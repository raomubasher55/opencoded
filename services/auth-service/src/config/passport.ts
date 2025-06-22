import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { UserModel } from '../models/user.model';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('passport-config');

// Environment variables for OAuth
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

/**
 * Initialize passport with OAuth strategies
 */
export function initializePassport() {
  // Serialize user ID for sessions
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from ID
  passport.deserializeUser(async (id: string, done: any) => {
    try {
      const user = await UserModel.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // GitHub OAuth Strategy
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: GITHUB_CALLBACK_URL,
      scope: ['user:email']
    }, async (
      accessToken: string, 
      refreshToken: string, 
      profile: any, 
      done: (error: Error | null, user?: any) => void
    ) => {
      try {
        // Check if user already exists with GitHub profile ID
        let user = await UserModel.findOne({ 'oauthProfiles.github': profile.id });
        
        // If user doesn't exist, create a new one
        if (!user) {
          // Get primary email from profile
          const emails = profile.emails;
          const primaryEmail = emails && emails.length > 0 ? emails[0].value : `${profile.username}@github.com`;
          
          // Check if user exists with this email
          user = await UserModel.findOne({ email: primaryEmail });
          
          if (user) {
            // If user exists with this email, update OAuth profile
            user.oauthProfiles = user.oauthProfiles || {};
            user.oauthProfiles.github = profile.id;
            await user.save();
          } else {
            // Create new user
            user = new UserModel({
              username: profile.username || profile.displayName.replace(/\s+/g, '') || `github_${profile.id}`,
              email: primaryEmail,
              passwordHash: Math.random().toString(36).substring(2), // Random string
              oauthProfiles: {
                github: profile.id
              },
              role: 'user'
            });
            await user.save();
          }
        }

        return done(null, user);
      } catch (err) {
        logger.error('Error in GitHub authentication', err);
        return done(err as Error, undefined);
      }
    }));
  } else {
    logger.warn('GitHub OAuth credentials not configured');
  }

  // Google OAuth Strategy
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email']
    }, async (
      accessToken: string, 
      refreshToken: string, 
      profile: any, 
      done: (error: Error | null, user?: any) => void
    ) => {
      try {
        // Check if user already exists with Google profile ID
        let user = await UserModel.findOne({ 'oauthProfiles.google': profile.id });
        
        // If user doesn't exist, create a new one
        if (!user) {
          // Get primary email from profile
          const emails = profile.emails;
          const primaryEmail = emails && emails.length > 0 ? emails[0].value : `${profile.id}@google.com`;
          
          // Check if user exists with this email
          user = await UserModel.findOne({ email: primaryEmail });
          
          if (user) {
            // If user exists with this email, update OAuth profile
            user.oauthProfiles = user.oauthProfiles || {};
            user.oauthProfiles.google = profile.id;
            await user.save();
          } else {
            // Create new user
            user = new UserModel({
              username: profile.displayName.replace(/\s+/g, '') || `google_${profile.id}`,
              email: primaryEmail,
              passwordHash: Math.random().toString(36).substring(2), // Random string
              oauthProfiles: {
                google: profile.id
              },
              role: 'user'
            });
            await user.save();
          }
        }

        return done(null, user);
      } catch (err) {
        logger.error('Error in Google authentication', err);
        return done(err as Error, undefined);
      }
    }));
  } else {
    logger.warn('Google OAuth credentials not configured');
  }
}