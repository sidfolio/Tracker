const defaultData = {
    version: 3,
    settings: {
        startDate: "2026-06-01T00:00:00",
        endDate: "2027-02-28T23:59:59",
        totalHours: 6480,
        userName: "Siddharth",
        targetSalary: 200000,
        targetLocation: "New York City"
    },
    goals: [
        { id: "g1", type: "daily", text: "Apply to 3 NYC Design Roles", completed: false },
        { id: "g2", type: "daily", text: "1 Hour React/TypeScript Practice", completed: false },
        { id: "g3", type: "weekly", text: "Attend 1 Networking Event/Webinar", completed: false },
        { id: "g4", type: "weekly", text: "Publish 1 LinkedIn update", completed: false },
        { id: "g5", type: "monthly", text: "Complete 1 High-Fidelity B2B Dashboard Prototype", completed: false }
    ],
    companies: {
        dream: ["Notion", "Figma", "Spotify"],
        ideal: ["Ramp", "Airbnb"],
        sweetSpot: ["Vercel", "Linear"],
        safeZone: ["Local NYC Agencies", "Mid-size B2B SaaS"],
        danger: ["Low-pay startups", "Roles misaligned with UX/Design Engineering"]
    },
    coach: {
        weaknesses: ["ADHD Distractions", "Time Management", "Coding Skills", "Math", "Imposter Syndrome"],
        strengths: ["Strong Visual Design", "UX Research", "Tangible Interactions", "Creative Output"],
        reminders: [
            "Your ADHD means it takes you 1-3 hours to focus. Start your block EARLY.",
            "You want that $200k in NYC? Put the guitar down for just one more hour.",
            "Maintain >3.5 GPA. Current: 3.7. Don't slip.",
            "You are a stellar designer. Don't let imposter syndrome win today."
        ]
    },
    journal: [],
    skills: {
  "hard": [
    "Developer Tools UX", "Marketing Website Design", "3+ Years Experience", "AI Prototyping Tools", "AI-Native Workflow", "Agentic Coding", "Research (NYU COPHEE)", "Ad Campaign Automation", "UX Metrics (Task Time)", "Business Outcomes", "HR/People Tech Domain", "3-5 Years Experience", "Senior Level Expectation", "Workflow Analysis", "Scale Software Experience", "Design System Contribution", "Marketing Domain", "Metric-Driven Design", "Cybersecurity Domain", "B2B Financial Services", "Stakeholder Alignment", "Cross-Platform Components", "End-to-End Lifecycle", "Senior Product Design", "Data Visualization", "Startup Experience", "Agile Teams", "Interaction Design", "Task Completion Analysis", "LLM Design Workflows", "Amplitude Analytics", "Startup Collaboration", "Accessibility (WCAG 2.1)", "IIT Bombay Project", "Degree Qualifications", "User Interviews", "Product Design Experience", "Data Dashboards", "UI Craft & Polish", "Design System Maintenance", "Reusable Component Library", "AI Tool Fluency", "Context-Switching Impact", "Full-time Commitment", "QA & Testing", "AI-First Products", "Cursor / Claude Code", "Rapid Experimentation", "Code Prototyping", "Unified Visual Language", "SEO Design", "Design Tokens", "HR/Benefits Platforms", "Hackathons / Competitions", "React & Tailwind", "Tailwind CSS", "Strategy & Roadmapping", "HTML / CSS", "Task Time Impact", "Internal Design Systems", "AI Prototyping (Cursor)", "32M+ User Base", "Advanced Data Analytics", "External Dependency Reduction", "0-1 Product Cycle", "Enterprise B2B Solutions", "Brand Identity Design", "Ad Tech / MarTech", "Trust in AI Systems", "Media / Audio Domain", "Scoping Negotiation", "Figma Make", "Spotify Quality Bar", "Feature Lifecycle", "Strategic System Governance"
  ],
  "moderate": [
    "Data Scientist Collaboration", "Behavioral Analytics", "B2B SaaS Audience", "Enterprise UX", "Balancing Viability", "Inclusivity Design", "End-to-End Ownership", "0-1 Greenfield Design", "AI Product Vision", "Core AI Features", "On-site Commitment", "AI Interaction Conventions", "Ambiguous Environments", "Scrappy Prototyping", "System Level Thinking", "Internal Tooling", "Presenting Success Stories", "US-based Contact", "Direct Business Impact", "Project Prioritization", "Curiosity (Side Projects)", "Agile / Squad Model", "Stakeholder Consensus", "Millions of Users", "Discovery to Delivery", "Platform-Level Systems", "Revenue Impact", "HR Workflow Journeys", "Storytelling & Facilitation", "Foundational Influence", "Trust & Safety UX", "Mobile Tech Constraints", "NYU Tandon Affiliation", "Industry Benchmarking", "Finance & Tech Interest", "Advertising Platforms", "Senior Lifecycle Depth", "Interaction Focus", "Extending Shared Components", "Rapid Ideation", "Establishing Design Culture", "Complex UX at Scale", "Obsession of Craft", "Design Ops Foundation", "Accountable for Outcomes", "Engineering Constraints", "Long-Term Vision", "Advocating for Design", "Cross-Functional Syncs", "Self-Serve Research", "Pixel Precise UIs", "Private Investment UX", "PM & Eng Partnership", "Frontend Concepts", "Scale Design Workshops", "Product Strategy Contribution", "Venture-Backed Startup", "System Evolution Mindset", "Complex System Simplification", "Scale Consumer Apps", "Internal Platform Scale", "Growing Independence", "Senior Leadership Recognition", "AI as Accelerator", "Interview Synthesis", "Full-time On-site", "Growth Platform Metrics"
  ],
  "soft": [
    "Extreme Ownership", "Challenge Status Quo", "Impactful Storytelling", "Startup Excitement", "Ambitious Problem Solving", "Collaborative & Kind", "Adaptable to Urgency", "Tackling Ambiguity", "Comfort with Unestablished", "Embracing LLM Tools", "Driving Innovation", "Figma-Native Expert", "Strategic Self-Branding", "Nimble Learning", "Evolving Google Scale Systems", "Problem Recognition Philosophy", "Deep Domain Curiosity", "Experimenting with AI", "Excitement for AI Research", "Quantifiable Impact Narrative", "Visual Cohesion Autonomy", "Thriving in Startups", "Iterative Shipping", "Results-Driven", "Seeking Feedback", "Scale-Up Environment Fit", "High Urgency", "User Empowerment", "Clear PM/Eng Communication", "Outcome Focus", "Timeline Alignment", "NYC Presence", "Uncovering AI Barriers", "In-Person Culture", "Autonomous Mindset", "Bias Toward Action", "Proactive Engagement", "Strategic Alignment Skills", "Iterating on Feedback", "Deep Portfolio Evidence", "Sharing Early & Often", "Builder Mentality", "Meticulous Accuracy", "Business/HR Customer Focus", "Brand UX Ownership", "Rethinking Interaction Basics", "Scrappy Iteration", "Entrepreneurial Fit", "Navigating Ambiguity", "Creative Opportunities", "Senior PM/Eng Strategy", "Seeking Insights Proactively", "Impact-Oriented Communication", "Culture Contribution", "High Agency", "Ambiguity Problem Solving", "Senior-Level Initiative"
  ]
}
};

function initData() {
    const existing = localStorage.getItem('nycTrackerData_v2');
    let needsUpdate = true;
    if (existing) {
        try {
            const parsed = JSON.parse(existing);
            if (parsed.version === 3) needsUpdate = false;
        } catch(e) {}
    }
    
    if (needsUpdate) {
        localStorage.removeItem('nycTrackerData_v2'); 
        localStorage.removeItem('nycTrackerData');
        localStorage.setItem('nycTrackerData_v2', JSON.stringify(defaultData));
    }
}

function getData() {
    return JSON.parse(localStorage.getItem('nycTrackerData_v2'));
}

function saveData(data) {
    localStorage.setItem('nycTrackerData_v2', JSON.stringify(data));
}

initData();
