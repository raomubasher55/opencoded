export interface Message {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: ToolCall[];
    timestamp: Date;
}
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: ToolResult;
}
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    metadata?: any;
}
export interface OAuthProfiles {
    github?: string;
    google?: string;
}
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash?: string;
    apiKeys?: ApiKey[];
    role: 'admin' | 'user';
    oauthProfiles?: OAuthProfiles;
    createdAt: Date;
    updatedAt: Date;
}
export interface ApiKey {
    id: string;
    key: string;
    name: string;
    createdAt: Date;
    expiresAt?: Date;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface FileOperation {
    operation: 'read' | 'write' | 'list' | 'delete' | 'edit';
    path: string;
    content?: string;
    options?: Record<string, any>;
}
export interface FileOperationResult {
    success: boolean;
    data?: any;
    error?: string;
}
export interface Session {
    id: string;
    userId: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}
export interface LlmConfig {
    provider: 'openai' | 'anthropic' | 'google' | 'bedrock';
    model: string;
    apiKey?: string;
    options?: Record<string, any>;
}
export interface LlmRequest {
    messages: Message[];
    options?: {
        temperature?: number;
        maxTokens?: number;
        stopSequences?: string[];
        tools?: ToolDefinition[];
        useTeamContext?: boolean;
    };
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, any>;
}
