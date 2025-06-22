import { LlmConfig, LlmRequest, Message } from '@opencode/shared-types';
import { createServiceLogger } from '@opencode/shared-utils';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { GoogleProvider } from '../providers/google.provider';
import { OpenRouterProvider } from '../providers/openrouter.provider';
import { SimulationProvider } from '../providers/simulation.provider';
import { 
  LlmProvider, 
  LlmCompletionOptions, 
  LlmCompletionResponse,
  LlmMessage,
  LlmTool
} from '../interfaces/llm-provider.interface';

const logger = createServiceLogger('llm-service');

// Provider factory type
type ProviderFactory = () => LlmProvider;

export class LlmService {
  private providers: Map<string, ProviderFactory> = new Map();
  private activeProvider: LlmProvider | null = null;
  private activeConfig: LlmConfig | null = null;

  constructor() {
    // Register available providers
    this.registerProvider('openai', () => new OpenAIProvider());
    this.registerProvider('anthropic', () => new AnthropicProvider());
    this.registerProvider('google', () => new GoogleProvider());
    this.registerProvider('openrouter', () => new OpenRouterProvider());
    this.registerProvider('simulation', () => new SimulationProvider());
    
    // Initialize with simulation provider by default
    this.initWithSimulation();
    
    logger.info('LLM service initialized');
  }
  
  /**
   * Initialize with simulation provider for development
   */
  private async initWithSimulation(): Promise<void> {
    try {
      const simulationConfig: LlmConfig = {
        provider: 'simulation',
        model: 'simulation-basic'
      };
      
      const simulationProvider = new SimulationProvider();
      await simulationProvider.initialize(simulationConfig);
      
      this.activeProvider = simulationProvider;
      this.activeConfig = simulationConfig;
      
      logger.info('LLM service initialized with simulation provider');
    } catch (error) {
      logger.error('Failed to initialize simulation provider', error);
    }
  }

  /**
   * Register a new LLM provider
   */
  registerProvider(name: string, factory: ProviderFactory): void {
    this.providers.set(name.toLowerCase(), factory);
    logger.info(`Registered LLM provider: ${name}`);
  }

  /**
   * Configure the service with a specific provider and model
   */
  async configure(config: LlmConfig): Promise<void> {
    try {
      const providerName = config.provider.toLowerCase();
      
      // If API key is missing and trying to use real providers, fall back to simulation
      if ((providerName === 'openai' || providerName === 'anthropic' || 
           providerName === 'google' || providerName === 'openrouter') && 
          (!config.apiKey || config.apiKey.includes('dummy-key-for-simulation'))) {
        logger.warn(`Missing API key for ${providerName}, falling back to simulation provider`);
        await this.initWithSimulation();
        return;
      }
      
      const providerFactory = this.providers.get(providerName);

      if (!providerFactory) {
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
      }

      // Create a new provider instance
      const provider = providerFactory();
      
      // Initialize the provider
      await provider.initialize(config);
      
      // Store as active provider
      this.activeProvider = provider;
      this.activeConfig = config;
      
      logger.info(`Configured LLM service to use ${config.provider} with model ${config.model}`);
    } catch (error) {
      logger.error('Failed to configure LLM service', error);
      
      // Fall back to simulation on error
      logger.warn('Falling back to simulation provider due to configuration error');
      await this.initWithSimulation();
    }
  }

  /**
   * Get the current active configuration
   */
  getActiveConfig(): LlmConfig | null {
    return this.activeConfig;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get available models for the current provider
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.activeProvider) {
      throw new Error('No LLM provider configured');
    }
    
    return await this.activeProvider.getAvailableModels();
  }

  /**
   * Convert standard Message format to provider-specific format
   */
  private convertMessages(messages: Message[]): LlmMessage[] {
    return messages.map(msg => {
      const llmMessage: LlmMessage = {
        role: msg.role,
        content: msg.content,
      };

      // Handle tool calls if present
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        llmMessage.toolCalls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        }));
      }

      return llmMessage;
    });
  }

  /**
   * Convert tool definitions to LLM tools format
   */
  private convertTools(tools?: any[]): LlmTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Create a completion
   */
  async createCompletion(request: LlmRequest): Promise<LlmCompletionResponse> {
    try {
      if (!this.activeProvider) {
        throw new Error('No LLM provider configured');
      }
      
      // Convert messages to provider format
      const messages = this.convertMessages(request.messages);
      
      // Prepare options
      const options: LlmCompletionOptions = {
        temperature: request.options?.temperature,
        maxTokens: request.options?.maxTokens,
        stopSequences: request.options?.stopSequences,
        tools: this.convertTools(request.options?.tools),
      };
      
      // Create completion
      return await this.activeProvider.createCompletion(messages, options);
    } catch (error) {
      logger.error('Error creating completion', error);
      throw error;
    }
  }

  /**
   * Create a streaming completion
   */
  async createStreamingCompletion(
    request: LlmRequest,
    onContent: (content: string) => void,
    onToolCall?: (toolCall: any) => void,
    onFinish?: (response: Partial<LlmCompletionResponse>) => void
  ): Promise<void> {
    try {
      if (!this.activeProvider) {
        throw new Error('No LLM provider configured');
      }
      
      // Convert messages to provider format
      const messages = this.convertMessages(request.messages);
      
      // Prepare options
      const options: LlmCompletionOptions = {
        temperature: request.options?.temperature,
        maxTokens: request.options?.maxTokens,
        stopSequences: request.options?.stopSequences,
        tools: this.convertTools(request.options?.tools),
        stream: true
      };
      
      // Create streaming completion
      await this.activeProvider.createStreamingCompletion(
        messages,
        options,
        onContent,
        onToolCall,
        onFinish
      );
    } catch (error) {
      logger.error('Error creating streaming completion', error);
      throw error;
    }
  }

  /**
   * Count tokens in messages
   */
  countTokens(messages: Message[]): number {
    if (!this.activeProvider) {
      throw new Error('No LLM provider configured');
    }
    
    return this.activeProvider.countTokens(this.convertMessages(messages));
  }
}