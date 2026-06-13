import { getTeamBySlug } from "@/lib/data/teams"
import type { TeamProfile } from "@/lib/data/teams"

// Hugging Face Inference API configuration
// Note: In a real app, you would store this in environment variables
// For this implementation, we'll handle it in the API route to keep the key secure

export interface AIAdvisorRequest {
  teamSlug: string
  leagueSlug: string
  userMessage: string
}

export interface AIAdvisorResponse {
  content: string
  error?: string
}

export class AIAdvisorService {
  /**
   * Get AI advice for team signings
   * @param request Contains team info and user's question
   * @returns AI response with recommendations
   */
  static async getAdvisorAdvice(
    request: AIAdvisorRequest,
  ): Promise<AIAdvisorResponse> {
    try {
      // Fetch detailed team data
      const team = await getTeamBySlug(request.leagueSlug, request.teamSlug)

      if (!team) {
        return {
          content: "Could not find the specified team.",
          error: "Team not found",
        }
      }

      // Construct the prompt with team context
      const prompt = this.buildPrompt(team, request.userMessage)

      // Return the prompt for the API route to process
      return {
        content: prompt,
      }
    } catch (error) {
      console.error("Error in AI advisor service:", error)
      return {
        content:
          "Sorry, there was an error processing your request. Please try again.",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Build a detailed prompt for the AI model with team context
   */
  private static buildPrompt(team: TeamProfile, userMessage: string): string {
    // Extract key information about the team
    const { name, league, roster } = team

    // Build roster summary
    const rosterSummary = roster
      .slice(0, 5)
      .map((player) => `${player.fullName} (${player.position || "N/A"})`)
      .join(", ")

    const rosterNote =
      roster.length > 5
        ? `${rosterSummary} and ${roster.length - 5} more`
        : rosterSummary

    return `
You are an expert basketball signing advisor with deep knowledge of the NBA, EuroLeague, and ACB leagues. 
Your task is to analyze a team's needs and provide specific signing recommendations.

TEAM INFO:
- Name: ${name}
- League: ${league.name} (${league.region})
- Current roster: ${rosterNote}

USER QUERY:
"${userMessage}"

INSTRUCTIONS:
1. Analyze the user's request in the context of the specific team and league
2. Consider factors such as: tactical fit, positional needs, team chemistry, market value, and player availability
3. Provide 2-3 specific player recommendations who are currently available (free agents, last year of contract, etc.)
4. For each recommendation, explain:
   - Why they fit the team
   - What they would specifically bring
   - Possible challenges or considerations
5. Keep a professional but accessible tone
6. Respond in English
7. If you don't have enough information to give a well-founded recommendation, state what additional data you would need

RESPONSE:
`
  }
}
