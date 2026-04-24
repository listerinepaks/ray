Ray Planning Document

Product concept

Ray is a private family journal for capturing and anticipating shared moments around sunrises and sunsets.

The app is not just a photo log. It is a family memory system built around light, time together, and reflection.

Core emotional idea:

Ray helps families remember what mattered and look ahead to what they hope to share.

⸻

1. Core features

1.1 Moment entries

A Moment is the central object in Ray.

Each moment can include:

* date and time
* sunrise or sunset type
* photo or photos
* people who were there
* written reflection
* location
* author
* comments
* reactions

Moment types:

* Past Moment
    * already happened
    * includes real photos and reflection
* Looking Ahead Moment
    * planned future sunrise or sunset
    * includes date, location, people, and a note about why it matters
    * may later be converted into a Past Moment

⸻

2. Key feature: Looking Ahead

Purpose

Looking Ahead lets families record future sunrises or sunsets they want to experience together.

This creates anticipation, not just memory.

Examples:

* “Sunrise at the beach on vacation”
* “Last sunset before Lexie leaves”
* “First morning at the cabin”
* “Sunset with grandparents”

Fields

A Looking Ahead entry should include:

* title optional
* date
* sunrise or sunset
* location
* people invited or hoped for
* note
* calculated sunrise or sunset time
* optional inspiration photo

Feed behavior

Looking Ahead moments should appear in the family feed alongside past moments, but visually distinct.

Suggested treatment:

* lighter card
* softer background
* subtle gold accent
* small label: Looking Ahead
* countdown text:
    * “Tomorrow”
    * “In 5 days”
    * “Tonight”
    * “Today”

Conversion behavior

When the date arrives, Ray should gently prompt:

“Did this happen?”

Then allow the user to:

* add photos
* update the reflection
* preserve the original Looking Ahead note
* convert it into a Past Moment

This creates a meaningful before and after story.

⸻

3. Social and family features

Ray should feel intimate, not like a public social network.

Core social features

* family groups
* people tagging
* comments
* reactions
* shared family feed
* person profile pages
* entries grouped by person

Important distinction

A Person is not always a logged-in user.

This allows children, grandparents, or relatives to be linked to memories without requiring accounts.

⸻

4. Recommended data model

User

Standard authenticated user.

Fields:

* id
* email
* name
* profile photo
* created at

⸻

Family

A private shared space.

Fields:

* id
* name
* created_by
* created_at

⸻

FamilyMembership

Links users to families.

Fields:

* id
* family
* user
* role

Suggested roles:

* owner
* adult
* contributor
* viewer

⸻

Person

A person who can be tagged in memories.

Fields:

* id
* family
* name
* linked_user nullable
* profile_photo nullable
* relationship_label optional
* created_at

⸻

Moment

Central journal entry.

Fields:

* id
* family
* author
* type: past or looking_ahead
* light_type: sunrise or sunset
* date
* calculated_light_time nullable
* title optional
* text
* location_name optional
* latitude optional
* longitude optional
* visibility
* created_at
* updated_at

⸻

MomentPhoto

Fields:

* id
* moment
* image
* caption optional
* sort_order
* created_at

⸻

MomentPerson

Join table between Moment and Person.

Fields:

* id
* moment
* person
* role optional

⸻

Comment

Fields:

* id
* moment
* author
* text
* created_at

⸻

Reaction

Fields:

* id
* moment
* user
* type
* created_at

⸻

5. App architecture

Backend

Use:

* Django
* Django REST Framework
* PostgreSQL
* S3-compatible storage for photos
* JWT or session based auth depending on app strategy

Primary responsibilities:

* authentication
* family permissions
* moments
* photos
* people
* comments
* reactions
* sunrise and sunset calculation
* API for web and mobile clients

⸻

Frontend strategy

Since the product needs both mobile and web, use:

* React Native with Expo for mobile
* React Native Web for web, if you want maximum shared code

This gives you one React based mental model and potentially shared components.

Alternative:

* React web with Vite
* Expo React Native mobile

This gives better web conventions, but less UI sharing.

Recommendation

For Ray, start with:

* Expo React Native mobile
* React Native Web for web
* shared API client
* shared types
* shared validation logic
* shared design tokens

⸻

6. Suggested project structure

ray/
  backend/
    Django API
  apps/
    mobile/
      Expo app
    web/
      React Native Web app
  packages/
    api/
      shared API client
    types/
      shared TypeScript types
    ui/
      shared design tokens and possible shared components

⸻

7. Core API endpoints

/auth/
  POST /login/
  POST /logout/
  POST /register/
/families/
  GET /families/
  POST /families/
  GET /families/:id/
/people/
  GET /people/
  POST /people/
  GET /people/:id/
  PATCH /people/:id/
/moments/
  GET /moments/
  POST /moments/
  GET /moments/:id/
  PATCH /moments/:id/
  DELETE /moments/:id/
/moments/:id/photos/
  POST /moments/:id/photos/
  DELETE /moments/:id/photos/:photo_id/
/moments/:id/comments/
  GET /moments/:id/comments/
  POST /moments/:id/comments/
/moments/:id/reactions/
  POST /moments/:id/reactions/
  DELETE /moments/:id/reactions/:reaction_id/
/moments/:id/convert/
  POST convert Looking Ahead moment into Past Moment

⸻

8. Key screens

Mobile

Home feed

Shows:

* past moments
* Looking Ahead moments
* family activity

Add moment

Fast capture flow:

1. choose sunrise or sunset
2. choose past or Looking Ahead
3. add date
4. add photo optional for future, expected for past
5. tag people
6. write note
7. save

Moment detail

Shows:

* photos
* text
* people
* comments
* reactions
* original Looking Ahead note if converted

People

Shows family members and people linked to moments.

Person profile

Shows all moments connected to that person.

⸻

9. Visual identity

Brand tone

Ray should feel:

* warm
* calm
* reflective
* spacious
* personal
* lightly nostalgic

Avoid:

* loud social media energy
* childish illustration
* overly technical design
* generic sun app style

⸻

Colors

Warm off-white: #FAF7F2
Cream card:     #F3EFE7
Golden accent: #F4C95D
Peach accent:  #F2A97B
Dusk blue:     #A7B7C9
Charcoal text: #2F2F2F
Muted text:    #6B6B6B

Typography

Use Google Fonts:

* Inter for UI, buttons, labels, body text
* Playfair Display for logo, titles, and occasional expressive headings

Logo direction

Current strongest direction:

* Playfair Display wordmark
* simple “Ray”
* restrained rays above the ay
* avoid large sun icons
* avoid overexplaining the concept

⸻

10. MVP scope

Build first

* user accounts
* family creation
* people records
* create Past Moment
* create Looking Ahead Moment
* upload photos
* tag people
* family feed
* comments
* reactions
* person profiles

Delay until later

* public sharing
* AI captions
* complex notifications
* advanced photo editing
* maps
* printed books
* multi-family sharing

⸻

11. Product principle

The app should not feel like task management.

Avoid language like:

* complete
* due
* checklist
* task

Use language like:

* remember
* look ahead
* together
* this mattered
* something to look forward to

Ray is about memory and anticipation, not productivity.