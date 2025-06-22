import { createServiceLogger } from '@opencode/shared-utils';
import fetch from 'node-fetch';
import { Message } from '@opencode/shared-types';

const logger = createServiceLogger('team-context-service');

/**
 * Service for enhancing LLM responses with team collaboration context
 */
export class TeamContextService {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    
    // Ensure API URL doesn't end with a slash
    if (this.apiUrl.endsWith('/')) {
      this.apiUrl = this.apiUrl.slice(0, -1);
    }
    
    logger.info('Team context service initialized');
  }

  /**
   * Fetch active session information for context enrichment
   */
  async getSessionContext(sessionId: string): Promise<any> {
    try {
      const collaborationUrl = this.apiUrl.replace('8080', '4005');
      
      const response = await fetch(`${collaborationUrl}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get session context: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error getting session context', error);
      return null;
    }
  }

  /**
   * Fetch active participants in a session
   */
  async getSessionParticipants(sessionId: string): Promise<any[]> {
    try {
      const collaborationUrl = this.apiUrl.replace('8080', '4005');
      
      const response = await fetch(`${collaborationUrl}/api/sessions/${sessionId}/participants`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get session participants: ${error.message || response.statusText}`);
      }

      const result = await response.json();
      return result.participants || [];
    } catch (error) {
      logger.error('Error getting session participants', error);
      return [];
    }
  }

  /**
   * Fetch recent comments in a session
   */
  async getSessionComments(sessionId: string, limit = 10): Promise<any[]> {
    try {
      const collaborationUrl = this.apiUrl.replace('8080', '4005');
      
      const response = await fetch(`${collaborationUrl}/api/comments/session/${sessionId}?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get session comments: ${error.message || response.statusText}`);
      }

      const result = await response.json();
      return result.comments || [];
    } catch (error) {
      logger.error('Error getting session comments', error);
      return [];
    }
  }

  /**
   * Fetch active threads in a session
   */
  async getSessionThreads(sessionId: string): Promise<any[]> {
    try {
      const collaborationUrl = this.apiUrl.replace('8080', '4005');
      
      const response = await fetch(`${collaborationUrl}/api/threads/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get session threads: ${error.message || response.statusText}`);
      }

      const result = await response.json();
      return result.threads || [];
    } catch (error) {
      logger.error('Error getting session threads', error);
      return [];
    }
  }

  /**
   * Enhance messages with team collaboration context
   */
  async enhanceWithTeamContext(messages: Message[]): Promise<Message[]> {
    if (messages.length === 0) {
      return messages;
    }
    
    // Get the session ID from the first message
    const sessionId = messages[0].sessionId;
    
    try {
      // Get session information
      const sessionInfo = await this.getSessionContext(sessionId);
      
      // If no session info is available, return original messages
      if (!sessionInfo) {
        return messages;
      }
      
      // Get participants and active collaborators
      const participants = await this.getSessionParticipants(sessionId);
      
      // Get recent comments
      const comments = await this.getSessionComments(sessionId);
      
      // Get active threads
      const threads = await this.getSessionThreads(sessionId);
      
      // Create context message
      const contextMessage: Message = {
        id: 'context-' + Date.now(),
        sessionId,
        role: 'system',
        content: this.buildTeamContextPrompt(sessionInfo, participants, comments, threads),
        timestamp: new Date()
      };
      
      // Add context message after the first system message
      const firstSystemIndex = messages.findIndex(m => m.role === 'system');
      
      if (firstSystemIndex >= 0) {
        return [
          ...messages.slice(0, firstSystemIndex + 1),
          contextMessage,
          ...messages.slice(firstSystemIndex + 1)
        ];
      } else {
        // If no system message exists, add it at the beginning
        return [contextMessage, ...messages];
      }
    } catch (error) {
      logger.error('Error enhancing messages with team context', error);
      return messages;
    }
  }

  /**
   * Build the team context prompt
   */
  private buildTeamContextPrompt(
    sessionInfo: any,
    participants: any[],
    comments: any[],
    threads: any[]
  ): string {
    let prompt = `## Team Collaboration Context\n\n`;
    
    // Add session information
    prompt += `You are participating in a collaborative coding session named "${sessionInfo.name}".\n`;
    
    // Add team information if available
    if (sessionInfo.teamId) {
      prompt += `This session is shared with the team "${sessionInfo.teamName || 'Team'}".\n`;
    }
    
    // Add participant information
    if (participants.length > 0) {
      prompt += `\n### Current Participants\n`;
      participants.forEach(p => {
        prompt += `- ${p.displayName} (${p.role}, status: ${p.status})\n`;
        if (p.cursor && p.cursor.file) {
          prompt += `  Currently editing: ${p.cursor.file} at line ${p.cursor.position.line}\n`;
        }
      });
    }
    
    // Add active threads information
    if (threads.length > 0) {
      prompt += `\n### Active Discussion Threads\n`;
      threads.slice(0, 5).forEach(t => {
        prompt += `- "${t.title}" (${t.status})\n`;
        if (t.fileId) {
          prompt += `  File: ${t.fileId}${t.lineNumber ? `, Line: ${t.lineNumber}` : ''}\n`;
        }
      });
    }
    
    // Add recent comments
    if (comments.length > 0) {
      prompt += `\n### Recent Comments\n`;
      comments.slice(0, 5).forEach(c => {
        prompt += `- ${c.username}: "${c.content.substring(0, 100)}${c.content.length > 100 ? '...' : ''}"\n`;
        if (c.fileId) {
          prompt += `  File: ${c.fileId}${c.lineNumber ? `, Line: ${c.lineNumber}` : ''}\n`;
        }
      });
    }
    
    // Add instructions for team-aware assistance
    prompt += `\n### Team Assistance Guidelines\n`;
    prompt += `- Consider the collaborative nature of this session when providing assistance\n`;
    prompt += `- Reference relevant discussions and threads when appropriate\n`;
    prompt += `- Be mindful of different participants' roles and expertise\n`;
    prompt += `- Provide explanations that are helpful for the entire team\n`;
    
    return prompt;
  }
}