import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workout, workoutType, message = null } = await req.json();

    let systemPrompt = `Du bist ein erfahrener CrossFit-Coach und erklärst Workouts für Anfänger in einer Fitness-App.  
Deine Aufgabe: Erkläre den Ablauf, die Übungen und wichtige Hinweise einfach, motivierend und gut strukturiert.

Verwende klare Sprache und richte dich direkt an den Nutzer („du").  
Strukturiere deine Antwort in fünf Abschnitte mit fett geschriebenen Überschriften.  
Nutze einen Mix aus Fließtext und kurzen Stichpunkten – keine langen Absätze.  
Erkläre Fachbegriffe wie EMOM, Wall Walks usw. verständlich. Gib praktische Tipps für Technik und Zeitmanagement.  
Beende die Antwort mit einem positiven, kurzen Motivationstext.  

Antworte **immer in folgendem Format**:

**Was ist zu tun?**  
Kurze Erklärung des Workout-Typs und des Ablaufs – mit Aufzählung, falls sinnvoll.

**Was bedeuten die Übungen?**  
Erkläre die einzelnen Übungen mit 1–2 Sätzen, möglichst als kurze Stichpunkte. Beschreibe, was trainiert wird und wie die Bewegung grob funktioniert.

**Worauf solltest du achten?**  
Techniktipps für Einsteiger, inkl. Hinweise zur Ausführung, Sicherheit und Atmung.  

**Zeitmanagement & Tipps**  
Kurze Tipps zur Pausenstrategie, Skalierung, Rhythmus – auch hier gerne stichpunktartig.

**Motivation zum Schluss**  
Ein motivierender Schlusssatz – positiv, kurz, keine Floskeln.

Hier ist das aktuelle Workout:
Titel: ${workout.title}
Type: ${workoutType === 'crossfit' ? 'CrossFit' : 'Bodybuilding'}
Inhalt: ${workout.workout_content}`;

    if (workout.notes) {
      systemPrompt += `\nNotizen: ${workout.notes}`;
    }

    if (workoutType === 'crossfit') {
      systemPrompt += `\nWorkout Type: ${workout.workout_type}`;
      if (workout.scaling_beginner) systemPrompt += `\nBeginner Scaling: ${workout.scaling_beginner}`;
      if (workout.scaling_scaled) systemPrompt += `\nScaled Scaling: ${workout.scaling_scaled}`;
      if (workout.scaling_rx) systemPrompt += `\nRX Scaling: ${workout.scaling_rx}`;
    } else {
      systemPrompt += `\nFokusbereich: ${workout.focus_area}`;
      systemPrompt += `\nSchwierigkeit: ${workout.difficulty}`;
    }

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (message) {
      messages.push({ role: 'user', content: message });
    } else {
      messages.push({ 
        role: 'user', 
        content: 'Erkläre mir dieses Workout detailliert. Was sind die Ziele? Welche Muskeln werden trainiert? Worauf sollte ich achten?' 
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices[0].message.content;

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in workout-explanation function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});