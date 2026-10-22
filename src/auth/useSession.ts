import { useReducer } from 'react'
import { DEFAULT_USER_ID, demoUsers } from '@/data/demoUsers'
import { workspacesFor, type AppUser, type Workspace } from './permissions'

/**
 * Who is signed in and which workspace they're using. Deliberately separate from the staffing
 * store: signing in as someone else or switching workspace never touches staffing data.
 * A real auth provider would replace `signInAs` and the demo user list.
 */

interface SessionState {
  userId: string
  workspace: Workspace | null
}

type SessionAction = { type: 'signInAs'; userId: string } | { type: 'switchWorkspace'; workspace: Workspace }

function userById(id: string): AppUser {
  const user = demoUsers.find((u) => u.id === id) ?? demoUsers.find((u) => u.id === DEFAULT_USER_ID)
  if (!user) throw new Error(`Unknown demo user ${id}`)
  return user
}

function landingWorkspace(user: AppUser, current: Workspace | null): Workspace | null {
  const allowed = workspacesFor(user)
  return current && allowed.includes(current) ? current : (allowed[0] ?? null)
}

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'signInAs': {
      const user = userById(action.userId)
      return { userId: user.id, workspace: landingWorkspace(user, state.workspace) }
    }
    case 'switchWorkspace':
      if (!workspacesFor(userById(state.userId)).includes(action.workspace)) return state
      return { ...state, workspace: action.workspace }
  }
}

export function useSession() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    userId: DEFAULT_USER_ID,
    workspace: landingWorkspace(userById(DEFAULT_USER_ID), null),
  }))
  const user = userById(state.userId)
  return {
    user,
    workspace: state.workspace,
    workspaces: workspacesFor(user),
    signInAs: (userId: string) => dispatch({ type: 'signInAs', userId }),
    switchWorkspace: (workspace: Workspace) => dispatch({ type: 'switchWorkspace', workspace }),
  }
}

export type Session = ReturnType<typeof useSession>
