interface ChatGPTSettings {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  enabled: boolean
}

interface ChatGPTResponse {
  success: boolean
  content?: string
  error?: string
}

import { loadSettings } from './storage'

// Function to analyze the context and category of selected text
function analyzeSelectedTextContext(selectedText: string): string {
  const text = selectedText.toLowerCase()
  
  // Camera and cinematography
  if (text.includes('drone') || text.includes('aerial') || text.includes('flyover')) {
    return 'drone_cinematography'
  }
  if (text.includes('shot') || text.includes('camera') || text.includes('lens') || text.includes('angle')) {
    return 'cinematography'
  }
  
  // People and characters
  if (text.includes('person') || text.includes('woman') || text.includes('man') || text.includes('child') || 
      text.includes('character') || text.includes('face') || text.includes('eyes') || text.includes('hair')) {
    return 'people'
  }
  
  // Movement and action
  if (text.includes('running') || text.includes('walking') || text.includes('dancing') || text.includes('moving') ||
      text.includes('action') || text.includes('motion') || text.includes('dynamic')) {
    return 'movement'
  }
  
  // Lighting
  if (text.includes('light') || text.includes('shadow') || text.includes('bright') || text.includes('dark') ||
      text.includes('illuminat') || text.includes('glow') || text.includes('golden hour')) {
    return 'lighting'
  }
  
  // Environment and locations
  if (text.includes('mountain') || text.includes('ocean') || text.includes('city') || text.includes('forest') ||
      text.includes('landscape') || text.includes('beach') || text.includes('desert') || text.includes('urban')) {
    return 'environment'
  }
  
  // Colors and mood
  if (text.includes('color') || text.includes('mood') || text.includes('atmosphere') || text.includes('tone') ||
      text.includes('vibrant') || text.includes('dramatic') || text.includes('serene')) {
    return 'mood_color'
  }
  
  // Technical aspects
  if (text.includes('resolution') || text.includes('quality') || text.includes('4k') || text.includes('8k') ||
      text.includes('professional') || text.includes('studio')) {
    return 'technical'
  }
  
  // Default to general improvement
  return 'general'
}

// Function to get context-specific improvement instructions
function getContextSpecificInstructions(context: string): string {
  switch (context) {
    case 'drone_cinematography':
      return 'You are an expert in drone cinematography. Improve the selected text by adding specific drone camera movements, flight patterns, aerial perspectives, and cinematic techniques. Focus on technical drone terminology, movement dynamics, and visual storytelling from aerial viewpoints.'
    
    case 'cinematography':
      return 'You are an expert in cinematography. Improve the selected text by adding specific camera techniques, shot compositions, lens choices, camera movements, and professional filming terminology. Focus on visual storytelling and technical camera work.'
    
    case 'people':
      return 'You are an expert in portrait and character description. Improve the selected text by adding detailed descriptions of human features, expressions, emotions, poses, styling, and character traits. Focus on bringing the person to life with vivid, specific details.'
    
    case 'movement':
      return 'You are an expert in capturing movement and action. Improve the selected text by adding dynamic motion descriptions, body language, energy, flow, and kinetic details. Focus on making the movement feel alive and engaging.'
    
    case 'lighting':
      return 'You are an expert in lighting and illumination. Improve the selected text by adding specific lighting techniques, quality of light, direction, color temperature, shadows, highlights, and atmospheric lighting effects.'
    
    case 'environment':
      return 'You are an expert in environmental and landscape description. Improve the selected text by adding detailed descriptions of the setting, atmosphere, natural elements, architecture, and spatial relationships. Focus on creating a vivid sense of place.'
    
    case 'mood_color':
      return 'You are an expert in color theory and mood creation. Improve the selected text by adding specific color palettes, emotional tones, atmospheric qualities, and mood-enhancing details that create the desired feeling.'
    
    case 'technical':
      return 'You are an expert in technical photography and video production. Improve the selected text by adding professional technical specifications, quality standards, equipment details, and industry-standard terminology.'
    
    default:
      return 'You are an expert in prompt engineering. Improve and make the selected text more detailed and precise within the context of the full prompt. Focus on enhancing the specific aspect mentioned in the selected text.'
  }
}

export class ChatGPTService {
  private settings: ChatGPTSettings | null = null

  constructor() {
    this.loadSettings()
  }

  private async loadSettings() {
    try {
      const savedSettings = await loadSettings()
      if (savedSettings) {
        this.settings = savedSettings.chatgpt
      }
    } catch (error) {
      console.error('Error loading ChatGPT settings:', error)
    }
  }

  private getModelOrDefault(): string {
    return (this.settings?.model && typeof this.settings.model === 'string' && this.settings.model.trim()) || 'gpt-5'
  }

  private async postWithModelFallback(bodyBuilder: (model: string) => any): Promise<Response> {
    const primaryModel = this.getModelOrDefault()
    const apiKey = this.settings!.apiKey
    if (!apiKey || apiKey.trim().length === 0) {
      // Simulate a 400 to fall into existing error flow
      return new Response(JSON.stringify({ error: { message: 'Missing API key' } }), { status: 400 })
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(bodyBuilder(primaryModel))
    })
    if (resp.ok) return resp

    // Try fallback if model not found/unsupported
    try {
      const err = await resp.json().catch(() => ({}))
      const msg = err?.error?.message?.toLowerCase?.() || ''
      if (resp.status === 404 || msg.includes('model') && (msg.includes('not') || msg.includes('unknown'))) {
        const fallbackModel = 'gpt-4o'
        if (primaryModel !== fallbackModel) {
          return fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(bodyBuilder(fallbackModel))
          })
        }
      }
    } catch {
      // ignore parse errors
    }
    return resp
  }

  private isConfigured(): boolean {
    return !!(this.settings?.apiKey && this.settings?.enabled)
  }

  async improvePrompt(prompt: string): Promise<ChatGPTResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'ChatGPT ist nicht konfiguriert. Bitte API-Key in den Einstellungen eingeben.' }
    }

    // Separate comments and content
    const lines = prompt.split('\n')
    const comments: string[] = []
    const contentLines: string[] = []
    
    lines.forEach(line => {
      if (line.trim().startsWith('//')) {
        comments.push(line)
      } else {
        contentLines.push(line)
      }
    })
    
    const promptWithoutComments = contentLines.join('\n').trim()

    if (!promptWithoutComments) {
      return { success: false, error: 'Prompt contains only comments. Please add some actual content.' }
    }

    try {
      const response = await this.postWithModelFallback((model) => ({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in prompt engineering. Improve the following prompt to make it more precise, creative, and effective. Return only the improved prompt without any additional explanations. Keep it in English.'
          },
          { role: 'user', content: promptWithoutComments }
        ],
        temperature: this.settings!.temperature,
        max_tokens: this.settings!.maxTokens
      }))

      if (!response.ok) {
        const errorData = await response.json()
        return { success: false, error: `API-Fehler: ${errorData.error?.message || 'Unbekannter Fehler'}` }
      }

      const data = await response.json()
      const improvedPrompt = data.choices[0]?.message?.content
      if (!improvedPrompt) {
        return { success: false, error: 'Keine Antwort von ChatGPT erhalten' }
      }

      const cleanedPrompt = improvedPrompt.replace(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g, '')
      const result = comments.length > 0 ? comments.join('\n') + '\n\n' + cleanedPrompt : cleanedPrompt
      return { success: true, content: result }
    } catch (error) {
      return { success: false, error: `Fehler bei der API-Anfrage: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` }
    }
  }

  async improveSelectedText(selectedText: string, context: string): Promise<ChatGPTResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'ChatGPT ist nicht konfiguriert. Bitte API-Key in den Einstellungen eingeben.' }
    }

    const contextWithoutComments = context
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .trim()

    const textContext = analyzeSelectedTextContext(selectedText)
    const contextSpecificInstructions = getContextSpecificInstructions(textContext)

    try {
      const response = await this.postWithModelFallback((model) => ({
        model,
        messages: [
          { role: 'system', content: `${contextSpecificInstructions} Return only the improved version of the selected text, without any additional explanations. Keep it in English.` },
          { role: 'user', content: `Context: ${contextWithoutComments}\n\nSelected text to improve: ${selectedText}\n\nProvide an improved and more detailed version of this selected text that fits naturally within the context.` }
        ],
        temperature: this.settings!.temperature,
        max_tokens: this.settings!.maxTokens
      }))

      if (!response.ok) {
        const errorData = await response.json()
        return { success: false, error: `API-Fehler: ${errorData.error?.message || 'Unbekannter Fehler'}` }
      }

      const data = await response.json()
      const improvedText = data.choices[0]?.message?.content
      if (!improvedText) {
        return { success: false, error: 'Keine Antwort von ChatGPT erhalten' }
      }

      return { success: true, content: improvedText.replace(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g, '') }
    } catch (error) {
      return { success: false, error: `Fehler bei der API-Anfrage: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` }
    }
  }

  async generateVariations(prompt: string): Promise<ChatGPTResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'ChatGPT ist nicht konfiguriert. Bitte API-Key in den Einstellungen eingeben.' }
    }

    const promptWithoutComments = prompt
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .trim()

    if (!promptWithoutComments) {
      return { success: false, error: 'Prompt contains only comments. Please add some actual content.' }
    }

    try {
      const response = await this.postWithModelFallback((model) => ({
        model,
        messages: [
          { role: 'system', content: 'You are an expert in prompt engineering. Create 3 different variations of the following prompt with different styles and approaches. Return them as a numbered list. Keep everything in English.' },
          { role: 'user', content: promptWithoutComments }
        ],
        temperature: (this.settings!.temperature ?? 0.7) + 0.2,
        max_tokens: this.settings!.maxTokens
      }))

      if (!response.ok) {
        const errorData = await response.json()
        return { success: false, error: `API-Fehler: ${errorData.error?.message || 'Unbekannter Fehler'}` }
      }

      const data = await response.json()
      const variations = data.choices[0]?.message?.content
      if (!variations) {
        return { success: false, error: 'Keine Antwort von ChatGPT erhalten' }
      }

      return { success: true, content: variations.replace(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g, '') }
    } catch (error) {
      return { success: false, error: `Fehler bei der API-Anfrage: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` }
    }
  }

  // Function to improve selected text with custom prompt
  async improveSelectedTextWithCustomPrompt(selectedText: string, context: string, customPrompt: string): Promise<ChatGPTResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'ChatGPT ist nicht konfiguriert. Bitte API-Key in den Einstellungen eingeben.'
      }
    }

    // Filter out comments from context for understanding, but keep original text
    const contextWithoutComments = context
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .trim()

    try {
      const response = await this.postWithModelFallback((model) => ({
        model,
        messages: [
            {
              role: 'system',
              content: 'You are an expert prompt engineer. Apply the user\'s custom instructions to improve the selected text. Return only the improved version of the selected text, without any additional explanations. Keep it in English.'
            },
            {
              role: 'user',
              content: `Context: ${contextWithoutComments}\n\nSelected text to improve: ${selectedText}\n\nCustom instructions: ${customPrompt}\n\nApply the custom instructions to improve the selected text. Make sure it fits naturally within the context.`
            }
          ],
          temperature: this.settings!.temperature,
          max_tokens: this.settings!.maxTokens
      }))

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `API-Fehler: ${errorData.error?.message || 'Unbekannter Fehler'}`
        }
      }

      const data = await response.json()
      const improvedText = data.choices[0]?.message?.content

      if (!improvedText) {
        return {
          success: false,
          error: 'Keine Antwort von ChatGPT erhalten'
        }
      }

      return {
        success: true,
        content: improvedText.replace(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g, '')
      }
    } catch (error) {
      return {
        success: false,
        error: `Fehler bei der API-Anfrage: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      }
    }
  }

  // INTELLIGENT PROMPT INTEGRATION - Smart element insertion
  async intelligentlyIntegratePromptElement(currentPrompt: string, newElement: string, elementCategory: string): Promise<ChatGPTResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'ChatGPT ist nicht konfiguriert. Bitte API-Key in den Einstellungen eingeben.'
      }
    }

    const cleanCurrentPrompt = currentPrompt.replace(/\/\/.*$/gm, '').trim()

    try {
      const response = await this.postWithModelFallback((model) => ({
        model,
        messages: [
            {
              role: 'system',
              content: `You are an expert at intelligently integrating new elements into existing image/video generation prompts. Your task is to seamlessly incorporate the new element into the most appropriate place in the existing prompt, replacing or enhancing similar elements if they exist.

RULES:
1. Analyze the current prompt structure and content
2. Find the most logical place to integrate the new element
3. If a similar element already exists, replace or enhance it intelligently
4. Maintain the overall flow and structure of the prompt
5. Keep all existing elements that don't conflict
6. Don't just append - integrate naturally
7. Preserve any comments (lines starting with //)
8. Return only the improved prompt without explanations`
            },
            {
              role: 'user',
              content: `Current prompt: "${currentPrompt}"

New element to integrate: "${newElement}"
Element category: "${elementCategory}"

Please intelligently integrate this new element into the existing prompt, finding the best place for it and replacing/enhancing any conflicting elements. Keep the prompt natural and well-structured.`
            }
          ],
          temperature: 0.3,
          max_tokens: 800
      }))

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `API-Fehler: ${errorData.error?.message || 'Unbekannter Fehler'}`
        }
      }

      const data = await response.json()
      const integratedPrompt = data.choices[0]?.message?.content

      if (!integratedPrompt) {
        return {
          success: false,
          error: 'Keine Antwort von ChatGPT erhalten'
        }
      }

      return {
        success: true,
        content: integratedPrompt.trim()
      }
    } catch (error) {
      return {
        success: false,
        error: `Fehler bei der API-Anfrage: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      }
    }
  }

  // Settings-Updates überwachen
  updateSettings() {
    this.loadSettings()
  }
}

export const chatGPTService = new ChatGPTService() 