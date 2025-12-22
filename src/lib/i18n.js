// src/lib/i18n.js
import { writable, derived, get } from 'svelte/store';

// Idioma por defecto (EN). Podrías leer de localStorage si lo deseas.
const initial = 'en';

export const availableLocales = ['en', 'es', 'hu'];
export const locale = writable(initial);

// Diccionario base
const dictionaries = {
  en: {
    common: {
      app_name: 'Village Storyteller',
      untitled: 'Untitled',
      untitled_session: 'Untitled session',
      loading: 'Loading…',
      error_prefix: 'Error',
      languages: {
        en: 'English',
        es: 'Spanish',
        hu: 'Hungarian'
      },
      actions: {
        view: 'View',
        edit: 'Edit',
        delete: 'Delete',
        cancel: 'Cancel',
        save: 'Save',
        close: 'Close',
        done: 'Done'
      },
      alerts: {
        default_title: 'Please review the information'
      }
    },
    topbar: {
      title: 'Storyteller Dashboard',
      language_label: 'Language',
      change_language: 'Change language',
      change_language_current: 'Change language, current: {language}',
      navigation_label: 'Top navigation',
      session_status_label: 'Session status',
      menu: {
        profile: 'User profile',
        logout: 'Logout'
      }
    },
    navigation: {
      back_to_login: 'Back to login',
      back_to_dashboard: 'Back to dashboard'
    },
    header: {
      title: 'The Village Storyteller',
      logo_alt: 'Village Storyteller logo'
    },
    login: {
      title: 'Login',
      storytellers: 'Storytellers',
      players: 'Players',
      choose_role: 'Choose how you want to enter',
      registration_cta: 'Registration',
      form: {
        section_label: 'Login with email',
        email_label: 'Email',
        email_placeholder: 'you@example.com',
        password_label: 'Password',
        password_placeholder: 'Enter your password',
        submit: 'Sign in',
        forgot: 'Forgot your password?',
        role_label: 'Sign in as',
        roles: {
          storyteller: 'Storyteller',
          player: 'Player'
        },
        register_prompt: "Don't have an account yet?",
        register_link: 'Create one here',
        errors: {
          missing_email: 'Please enter an email address.',
          invalid_email: 'Please enter a valid email address.',
          missing_password: 'Please enter your password.',
          invalid_credentials: 'Incorrect email or password.',
          email_not_verified: 'Please verify your email address before signing in.',
          account_inactive: 'Your account is inactive. Check your inbox to verify your email or contact support.',
          account_disabled: 'This account is disabled. Contact support.',
          too_many_attempts: 'Too many attempts. Try again later.',
          generic: 'Login failed. Please try again.'
        },
        success: {
          reset_link_sent: 'If that email exists, we have sent you a reset link.'
        }
      }
    },
    registration: {
      title: 'Registration',
      intro: 'Complete the form to create your account.',
      alert_title: 'Complete the missing information',
      name_label: 'Full name',
      name_placeholder: 'John Doe',
      alias_label: 'Nickname',
      alias_placeholder: 'Optional nickname',
      avatar_label: 'Avatar',
      avatar_help: 'Choose from gallery or upload your own.',
      avatar_change_button: 'Change avatar',
      avatar_selected_alt: 'Selected avatar',
      avatar_modal_title: 'Choose your avatar',
      avatar_modal_help: 'Pick one of the preset avatars for your profile.',
      avatar_option: {
        default: 'Default',
        andrea: 'Andrea',
        attila: 'Attila',
        geri: 'Geri',
        giuliano: 'Giuliano',
        laura: 'Laura',
        martin: 'Martin',
        mate: 'Mate',
        matyas: 'Mátyás',
        emese: 'Emese',
        natalia: 'Natalia',
        ramon: 'Ramón',
        sarolta: 'Sarolta',
        sofia: 'Sofia',
        timea: 'Tímea'
      },
      avatar_custom_label: 'Upload your own avatar',
      avatar_custom_hint: 'PNG or JPG up to 5 MB.',
      avatar_custom_preview_alt: 'Custom avatar preview',
      avatar_use_custom: 'Use uploaded avatar',
      optional: 'optional',
      email_label: 'Email address',
      email_placeholder: 'you@example.com',
      password_label: 'Password',
      password_requirements: 'Use at least 10 characters with uppercase, lowercase, numbers and symbols.',
      password_placeholder: 'Create a secure password',
      confirm_password_label: 'Confirm password',
      confirm_password_placeholder: 'Repeat the password',
      submit: 'Create account',
      back_to_login: 'Back to login',
      success: {
        verification_sent: 'We have sent a verification email to {email}. Please check your inbox.'
      },
      errors: {
        registration_error: 'Could not complete registration. Please try again.',
        missing_name: 'Please enter your full name.',
        missing_email: 'Please enter your email address.',
        invalid_email: 'Please enter a valid email address.',
        missing_password: 'Please enter a password.',
        missing_confirm: 'Please confirm your password.',
        password_mismatch: 'Passwords do not match.',
        password_strength: 'Password does not meet the security requirements.',
        email_in_use: 'There is already an account with this email address.',
        custom_avatar_invalid: 'Please choose a PNG or JPG file up to 5 MB.'
      }
    },
    profile: {
      title: 'Profile',
      intro: 'Update your account details and security settings.',
      status: {
        active: 'Account active',
        inactive: 'Account inactive',
        pending_verification: 'Check your email and click the verification link to activate your account.'
      },
      name_label: 'Full name',
      name_placeholder: 'John Doe',
      alias_label: 'Nickname',
      alias_placeholder: 'Optional nickname',
      optional: 'optional',
      email_label: 'Email address',
      email_placeholder: 'you@example.com',
      email_hint: 'Changing email will require new address verification.',
      avatar_label: 'Avatar',
      avatar_hint: 'Choose from gallery or upload your own.',
      avatar_change_button: 'Change avatar',
      avatar_current_alt: 'Selected avatar preview',
      avatar_modal_title: 'Choose your avatar',
      avatar_modal_help: 'Pick one of the preset avatars or upload a custom image.',
      avatar_custom_label: 'Upload custom avatar',
      avatar_custom_hint: 'PNG or JPG up to 5 MB.',
      avatar_custom_preview_alt: 'Custom avatar preview',
      avatar_use_custom: 'Use uploaded avatar',
      avatar_save_selection: 'Save avatar',
      security_section: 'Security',
      current_password_label: 'Current password',
      required_for_sensitive: 'Required for email or password changes',
      required_short: 'Required',
      current_password_placeholder: 'Enter your current password',
      new_password_label: 'New password',
      new_password_placeholder: 'Create a new secure password',
      confirm_password_label: 'Confirm new password',
      confirm_password_placeholder: 'Repeat the new password',
      password_requirements: 'Use at least 10 characters combining uppercase, lowercase, numbers and symbols.',
      save: 'Save',
      back: 'Back',
      success: {
        profile_updated: 'Your profile has been updated.',
        password_updated: 'Password updated successfully.',
        no_changes: 'There were no changes to save.',
        email_verification_sent: 'We have sent a verification email to {email}. Please check your inbox.'
      },
      errors: {
        password_required: 'Please enter a new password.',
        password_mismatch: 'Passwords do not match.',
        password_strength: 'Password does not meet the security requirements.',
        missing_current_password: 'Enter your current password to continue.',
        invalid_current_password: 'The current password is incorrect.',
        too_many_attempts: 'Too many attempts. Try again later.',
        requires_recent_login: 'For security, please sign in again and retry.',
        email_in_use: 'There is already an account with this email address.',
        custom_avatar_invalid: 'Please choose a PNG or JPG file up to 5 MB.',
        generic: 'We could not update your profile. Please try again.'
      },
      delete: {
        title: 'Danger zone',
        description: 'Delete your account and every stored session, avatar, and triumph tied to it.',
        playful_warning:
          'If you go through with this, every tale, laugh, and wolf-taming exploit you shared here will vanish into legend forever.',
        button: 'Delete my account',
        modal_title: 'Delete account',
        modal_hint: 'This action permanently removes your user profile and related data.',
        modal_warning: 'Are you absolutely sure? Once the wolves forget your jokes, they never come back.',
        confirm_label: 'Type “{code}” to confirm.',
        confirm_placeholder: 'Enter {code}',
        confirm_code: 'DELETE',
        password_label: 'Current password',
        password_placeholder: 'Enter your current password',
        confirm_button: 'Yes, delete everything',
        success: 'Your account has been deleted. Thanks for the stories!',
        errors: {
          code_mismatch: 'Please type “{code}” exactly to confirm.',
          missing_password: 'Enter your current password to delete the account.',
          requires_recent_login: 'For security, please sign in again and retry.',
          generic: 'We could not delete your account. Please try again.'
        }
      }
    },
    configure: {
      title: 'Configure',
      heading: 'Configure',
      intro: 'Set up your session details before sharing with players.',
      properties_title: 'Game properties',
      selection_title: 'Role selection',
      selection_hint: 'Adjust how many roles come from each group. Override limits to ignore the suggested mix.',
      selection_placeholder: 'Roles from this group',
      selection_placeholder_hint: 'Detailed role gallery coming soon.',
      selection_counts: '{selected}/{required} selected',
      selection_counts_unbound: '{selected} selected',
      description_label: 'Session description',
      description_placeholder: 'Share what the players should expect in this story…',
      description_hint: 'This text is shown to players inside the waiting room.',
      title_label: 'Session title',
      title_placeholder: 'Game session name…',
      ruleset_label: 'Rule set',
      players_label: 'Players',
      balance_label: 'Role mix',
      balance_roles: {
        villagers: 'Villagers',
        ambiguous: 'Ambiguous',
        loners: 'Loners',
        werewolves: 'Werewolves'
      },
      role_selector_label: 'Role selection',
      role_override_label: 'Override limits',
      role_limit: 'Max {count}',
      role_limit_unset: 'No limit',
      role_override_active: 'Override enabled',
      role_constraints: {
        ruleset: 'Rule set: {value}',
        mix: 'Suggested mix for {value} players'
      },
      session_stats_label: 'Session metrics',
      players_counters_heading: 'Players counters',
      expected_label: 'Expected',
      connected_label: 'Connected',
      ready_label: 'Ready',
      start_disabled_hint: 'All expected players must be connected and ready before starting.',
      btn_properties: 'Properties',
      btn_selection: 'Roles',
      btn_match: 'Match',
      btn_distribution: 'Distribution',
      btn_share: 'Share session',
      btn_edit_selection: 'Select roles',
      start_button: 'Start game',
      continue_button: 'Continue',
      director_label: 'Storyteller',
      language_label: 'Assistant language',
      assist_label: 'AI assistance',
      assist_no_tasks: 'No assistant tasks available yet.',
      assist_tasks: {
        roles_selection: 'Selection of roles in play',
        roles_matching: 'Match roles with players',
        introduction: 'Narrative introduction',
        night: 'Night guidance',
        day: 'Day guidance',
        votes: 'Vote arbitration',
        execution: 'Execution narration',
        summary: 'Daily summaries',
        logbook: 'Story logbook'
      },
      match_title: 'Assign roles',
      match_hint: 'Assign each selected role to a connected player manually or let the system do it for you.',
      match_players_title: 'Players waiting',
      match_roles_title: 'Assigned role',
      match_no_players: 'No connected players yet.',
      match_no_roles: 'Select roles first to enable assignments.',
      match_unassigned: 'Unassigned',
      match_status_ready: 'Ready',
      match_status_connected: 'Connected',
      match_auto: 'Auto assign',
      match_manual: 'Manual assignment',
      distribution_title: 'Distribution',
      distribution_hint: 'Coming soon: drag role tokens around to build your seating chart.',
      share_title: 'Share session',
      share_hint: 'Scan or type this code from the player portal to join the session.',
      share_qr_placeholder: 'QR code placeholder',
      share_qr_generating: 'Generating QR…',
      share_qr_alt: 'QR code for this session',
      role_preview_empty: 'No roles selected yet',
      back: 'Back to dashboard',
      save: 'Save',
      saved: 'Saved!',
      loading: 'Loading configuration…',
      errors: {
        missing_title: 'Please enter a session title before saving.',
        missing_session: 'No session is selected.',
        missing_game_id: 'Generate or enter a Game ID before sharing.',
        share_unavailable: 'Complete the role selection before sharing.',
        save_failed: 'We could not save these settings. Try again.',
        share_failed: 'We could not mark the session as shared.',
        start_failed: 'We could not update the session status.',
        load_failed: 'We could not load this session.',
        start_requirements: 'You need {expected} players connected and ready before starting.'
      }
    },
    session: {
      title: 'Session',
      distribution: {
        label: 'Distribution',
        title: 'Session #{id}',
        hint: 'Drag and drop tokens to arrange the table',
        fullscreen: 'Fullscreen',
        exit_fullscreen: 'Exit fullscreen'
      },
      phases: {
        label: 'Phase order',
        current: 'Current phase',
        preparation: { title: 'Preparation', subtitle: 'Setup and initial roles' },
        first_night: { title: 'First night', subtitle: 'Opening calls' },
        first_day: { title: 'First day', subtitle: 'First daylight' },
        each_night: { title: 'Each night', subtitle: 'Standard order' },
        each_day: { title: 'Each day', subtitle: 'Daytime actions' },
        hunter: { title: 'Hunter', subtitle: '' },
        sheriff: { title: 'Sheriff', subtitle: '' },
        end: { title: 'End', subtitle: '' },
        steps: {
          cards_dealt: 'Character cards are dealt',
          prejudiced_manipulator: 'Village separated for Prejudiced Manipulator',
          gypsy_cards: 'Gypsy cards (if in play)',
          town_crier_cards: 'Town Crier cards (if in play)',
          thief_cards: 'Thief receives extra cards',
          actor_cards: 'Actor receives three cards',
          sheriff_election: 'Sheriff election (can be later)',
          thief: 'The Thief acts',
          actor: 'The Actor decides their card',
          cupid: 'Cupid selects lovers',
          seer: 'The Seer acts',
          fox: 'The Fox acts',
          lovers: 'Lovers recognize each other',
          wandering_judge: 'Wandering Judge sets signal',
          sisters: 'Two Sisters open eyes',
          brothers: 'Three Brothers open eyes',
          wild_child: 'Wild Child chooses a role model',
          bear_tamer: 'Bear Tamer growls if a werewolf is nearby',
          scandalmonger: 'Scandalmonger acts',
          pyromaniac: 'Pyromaniac acts',
          defender: 'Defender shields a player',
          werewolves: 'Werewolves act (Little Girl may spy)',
          baker: 'Baker opens then closes eyes',
          cursed_wolf_father: 'Cursed Wolf-Father may infect',
          big_bad_wolf: 'Big Bad Wolf acts',
          witch: 'Witch decides heal/poison',
          gypsy: 'Gypsy may choose a Medium',
          piper: 'Piper charms players',
          charmed: 'Charmed players act',
          actor_night: 'The Actor (if cards remain)',
          white_werewolf: 'White Werewolf acts (every other night)',
          victims: 'Victims are revealed and resolve effects',
          bear_grunt: 'Bear’s grunt',
          medium: 'Medium (chosen by Gypsy)',
          town_crier: 'Town Crier announces',
          debate: 'Debate and accusations',
          vote: 'Vote (check Devoted Servant)',
          angel: 'Angel may win (if first vote)',
          second_vote: 'Possible second vote (Wandering Judge)'
        }
    },
    progress: {
      default_label: 'Progress',
      phase_label: 'Phase {current}/{total}'
    },
    victory: {
      label: 'Victory conditions',
      subtitle: '',
      village: 'Village wins (all Werewolves eliminated)',
      werewolves: 'Werewolves win (wolves reach parity)',
      lovers: 'Lovers win (only lovers remain)',
      piper: 'Piper wins (all charmed)',
      angel: 'Angel wins (first vote/night elimination)',
      draw: 'Draw / cancelled'
    },
    logbook: {
      label: 'Logbook',
      placeholder: 'Write what happens to craft the summary and emails…',
      add_entry: 'Add entry',
      empty: 'No entries yet.',
      entry_label: 'Entry #{num}',
      actor_becomes: 'Actor becomes {role} for this night'
      },
      controls: {
        previous: 'Previous',
        next: 'Next',
        evaluate_phase: 'Evaluate phase',
        finish: 'Finish',
        cancel: 'Cancel',
        fullscreen: 'Fullscreen',
        exit_fullscreen: 'Exit fullscreen'
      },
      sheriff: {
        assigned: 'Sheriff assigned',
        lost: 'Sheriff badge lost'
      },
      fox: {
        modal_title: 'Fox senses…',
        option: {
          werewolf: 'Werewolf',
          villager: 'Villager'
        },
        log: {
          werewolf: 'Fox senses a werewolf nearby',
          villager: 'Fox senses no werewolves'
        }
      }
    },
    verify: {
      title: 'Email verification',
      checking_title: 'Verifying email…',
      checking_message: 'Please wait while we confirm your verification link.',
      success_title: 'Email verified',
      success_message: 'Thanks! {email} is now confirmed.',
      success_hint: 'Your account is active. You can sign in now.',
      success_redirect: 'Redirecting you to login…',
      unknown_email: 'your email',
      invalid_title: 'Invalid verification link',
      invalid_message: 'We could not read the verification link. Request a new email from your profile settings.',
      error_title: 'We could not verify your email',
      error_message: 'We could not complete the verification. {reason}',
      error_invalid_code: 'The verification code is invalid or has already been used.',
      error_expired_code: 'The verification link has expired.',
      error_generic_reason: 'Request a new verification email and try again.',
      go_login: 'Return to login'
    },
    player: {
      choose_title: 'Choose',
      join_methods: 'Choose how to join',
      join_intro: 'Scan a QR code, enter a session ID or pick one from the list.',
      scan_qr: 'Scan QR code',
      session_id: 'Game ID',
      session_id_placeholder: 'Enter the game ID',
      session_id_hint: "You will find this code on the storyteller's screen.",
      connect: 'Connect',
      connect_selected: 'Connect to selected session',
      active_sessions: 'Available sessions',
      active_sessions_hint: 'Sessions shared by the storyteller appear here.',
      refresh: 'Refresh',
      loading: 'Loading sessions…',
      no_sessions: 'No sessions available right now.',
      load_error: 'Unable to load sessions. Try again.',
      invalid_id: 'We could not find that session.',
      connect_error: 'Could not connect to the session. Please try again.',
      created_at: 'Created',
      updated_at: 'Updated',
      errors: {
        session_full: 'This session already has the maximum number of players.',
        session_unavailable: 'You can only join sessions that are shared, waiting or in progress.',
        missing_player: 'We could not identify your player profile.',
        generic: 'Could not connect to the session. Please try again.'
      },
      waiting: {
        heading: 'Waiting',
        title: 'Waiting',
        subtitle: 'Hang tight while the storyteller prepares the tale.',
        description_title: 'About this session',
        description_empty: 'The storyteller has not written a description yet.',
        roles_title: 'Roles in play',
        roles_empty: 'Roles will appear here once the storyteller finalizes the setup.',
        roles_count: '{count} roles selected',
        players_title: 'Players',
        players_empty: 'No other players are connected yet.',
        ready_connected: 'Connected',
        ready_ready: 'Ready',
        ready_hint: 'Mark yourself ready when you are set to play.',
        ready_mark: 'Ready',
        ready_cancel: 'Cancel',
        leave_room: 'Leave room',
        chat_title: 'Chat',
        chat_placeholder: 'Send a short message',
        chat_empty: 'No messages yet. Say hi!',
        chat_send: 'Send',
        chat_sending: 'Sending…',
        chat_error: 'We could not send your message.',
        join_full: 'This session already reached the expected number of players.',
        join_unavailable: 'This session is no longer available.'
      }
    },
    landing: {
      current: {
        heading: 'Current Session',
        subtitle: 'Manage or resume the storyteller session currently in progress.',
        checking: 'Checking current game session…',
        active_prefix: 'Active game:',
        no_active: 'No active game sessions right now.',
        create: 'Create new game',
        creating: 'Creating…',
        create_error: 'We could not create the session. Please check the console logs.',
        load_error: 'We could not load the current session.',
        view: 'View current game',
        view_forbidden: 'You can only open sessions you created.'
      },
      history: {
        title: 'History',
        subtitle: 'Review previously created sessions and their outcomes.',
        search_placeholder: 'Search by title, status or winner…',
        loading: 'Loading…',
        error_prefix: 'Error',
        load_failed: 'We could not load the history.',
        empty: 'There are no sessions recorded.',
        empty_with_query: 'There are no results for “{query}”.',
        delete_forbidden: 'You can only delete sessions you created.',
        delete_failed: 'We could not delete this session. Try again later.',
        delete_modal_title: 'Delete session',
        delete_modal_message: 'Are you sure you want to delete this game session? If you delete it now, you cannot recover it later.',
        delete_modal_prompt: 'Type “{word}” to confirm you understand this action cannot be undone.',
        delete_modal_placeholder: 'Type {word}',
        delete_modal_confirm: 'Delete session',
        delete_modal_cancel: 'Cancel',
        delete_modal_word: 'delete'
      },
      footbar: {
        signature: '@chatgpt-juarnamon intellectual property',
        aria_label: 'Application footer'
      }
    },
    history: {
      headers: {
        title: 'Title',
        num_players: 'Num players',
        winners: 'Winner/s',
        date: 'Date',
        status: 'Status',
        actions: 'Actions'
      }
    },
    status: {
      draft: 'Draft',
      shared: 'Shared',
      waiting: 'Waiting',
      in_progress: 'In progress',
      paused: 'Paused',
      finished: 'Finished',
      cancelled: 'Cancelled'
    },
    app: {
      placeholders: {
        configure_title: 'Game configuration',
        session_title: 'Active session',
        session_id: 'Game ID: {id}'
      }
    }
  },
  es: {
    common: {
      app_name: 'Village Storyteller',
      untitled: 'Sin título',
      untitled_session: 'Sesión sin título',
      loading: 'Cargando…',
      error_prefix: 'Error',
      languages: {
        en: 'Inglés',
        es: 'Español',
        hu: 'Húngaro'
      },
      actions: {
        view: 'Ver',
        edit: 'Editar',
        delete: 'Eliminar',
        cancel: 'Cancelar',
        save: 'Guardar',
        close: 'Cerrar',
        done: 'Aceptar'
      },
      alerts: {
        default_title: 'Revisa la información'
      }
    },
    topbar: {
      title: 'Panel del Narrador',
      language_label: 'Idioma',
      change_language: 'Cambiar idioma',
      change_language_current: 'Cambiar idioma, actual: {language}',
      navigation_label: 'Barra de navegación',
      session_status_label: 'Estado de la sesión',
      menu: {
        profile: 'Perfil de usuario',
        logout: 'Cerrar sesión'
      }
    },
    navigation: {
      back_to_login: 'Volver al login',
      back_to_dashboard: 'Volver al panel'
    },
    header: {
      title: 'El Narrador de la Aldea',
      logo_alt: 'Logotipo de Village Storyteller'
    },
    login: {
      title: 'Login',
      storytellers: 'Narradores',
      players: 'Jugadores',
      choose_role: 'Elige cómo quieres entrar',
      registration_cta: 'Registro',
      form: {
        section_label: 'Accede con tu correo',
        email_label: 'Correo electrónico',
        email_placeholder: 'tu@ejemplo.com',
        password_label: 'Contraseña',
        password_placeholder: 'Introduce tu contraseña',
        submit: 'Iniciar sesión',
        forgot: '¿Olvidaste la contraseña?',
        role_label: '¿Cómo quieres acceder?',
        roles: {
          storyteller: 'Narrador',
          player: 'Jugador'
        },
        register_prompt: '¿Aún no tienes cuenta?',
        register_link: 'Regístrate aquí',
        errors: {
          missing_email: 'Introduce una dirección de correo.',
          invalid_email: 'Introduce una dirección de correo válida.',
          missing_password: 'Introduce tu contraseña.',
          invalid_credentials: 'Correo o contraseña incorrectos.',
          email_not_verified: 'Debes verificar tu correo electrónico antes de iniciar sesión.',
          account_inactive: 'Tu cuenta está inactiva. Revisa tu correo para verificarla o contacta con soporte.',
          account_disabled: 'Esta cuenta está deshabilitada. Contacta con soporte.',
          too_many_attempts: 'Demasiados intentos. Intenta de nuevo más tarde.',
          generic: 'No se pudo iniciar sesión. Inténtalo de nuevo.'
        },
        success: {
          reset_link_sent: 'Si el correo existe, te hemos enviado un enlace de recuperación.'
        }
      }
    },
    registration: {
      title: 'Registro',
      intro: 'Completa el formulario para crear tu cuenta.',
      alert_title: 'Completa la información pendiente',
      name_label: 'Nombre completo',
      name_placeholder: 'Marina Pérez',
      alias_label: 'Apodo',
      alias_placeholder: 'Apodo opcional',
      avatar_label: 'Avatar',
      avatar_help: 'Elige desde la galería o sube uno propio.',
      avatar_change_button: 'Cambiar avatar',
      avatar_selected_alt: 'Avatar seleccionado',
      avatar_modal_title: 'Elige tu avatar',
      avatar_modal_help: 'Elige uno de los avatares prediseñados para tu perfil.',
      avatar_option: {
        default: 'Predeterminado',
        andrea: 'Andrea',
        attila: 'Attila',
        geri: 'Geri',
        giuliano: 'Giuliano',
        laura: 'Laura',
        martin: 'Martin',
        mate: 'Mate',
        matyas: 'Mátyás',
        emese: 'Emese',
        natalia: 'Natalia',
        ramon: 'Ramón',
        sarolta: 'Sarolta',
        sofia: 'Sofía',
        timea: 'Tímea'
      },
      avatar_custom_label: 'Sube tu propio avatar',
      avatar_custom_hint: 'PNG o JPG de hasta 5 MB.',
      avatar_custom_preview_alt: 'Vista previa del avatar personalizado',
      avatar_use_custom: 'Usar avatar subido',
      optional: 'opcional',
      email_label: 'Correo electrónico',
      email_placeholder: 'tu@ejemplo.com',
      password_label: 'Contraseña',
      password_requirements: 'Usa al menos 10 caracteres combinando mayúsculas, minúsculas, números y símbolos.',
      password_placeholder: 'Crea una contraseña segura',
      confirm_password_label: 'Confirmar contraseña',
      confirm_password_placeholder: 'Repite la contraseña',
      submit: 'Crear cuenta',
      back_to_login: 'Volver a iniciar sesión',
      success: {
        verification_sent: 'Hemos enviado un correo de verificación a {email}. Revisa tu bandeja.'
      },
      errors: {
        registration_error: 'No se pudo completar el registro. Inténtalo de nuevo.',
        missing_name: 'Introduce tu nombre completo.',
        missing_email: 'Introduce tu correo electrónico.',
        invalid_email: 'Introduce un correo electrónico válido.',
        missing_password: 'Escribe una contraseña.',
        missing_confirm: 'Confirma tu contraseña.',
        password_mismatch: 'Las contraseñas no coinciden.',
        password_strength: 'La contraseña no cumple los requisitos de seguridad.',
        email_in_use: 'Ya existe una cuenta con este correo electrónico.',
        custom_avatar_invalid: 'Selecciona un archivo PNG o JPG de hasta 5 MB.'
      }
    },
    profile: {
      title: 'Perfil',
      intro: 'Actualiza los datos de tu cuenta y la seguridad.',
      status: {
        active: 'Cuenta activa',
        inactive: 'Cuenta inactiva',
        pending_verification: 'Verifica tu correo electrónico para activar la cuenta.'
      },
      name_label: 'Nombre completo',
      name_placeholder: 'Marina Pérez',
      alias_label: 'Apodo',
      alias_placeholder: 'Apodo opcional',
      optional: 'opcional',
      email_label: 'Correo electrónico',
      email_placeholder: 'tu@ejemplo.com',
      email_hint: 'Cambiar el correo requiere verificar la nueva dirección.',
      avatar_label: 'Avatar',
      avatar_hint: 'Elige desde la galería o sube uno propio.',
      avatar_change_button: 'Cambiar avatar',
      avatar_current_alt: 'Avatar seleccionado',
      avatar_modal_title: 'Elige un nuevo avatar',
      avatar_modal_help: 'Selecciona un avatar prediseñado o sube tu propia imagen.',
      avatar_custom_label: 'Subir avatar personalizado',
      avatar_custom_hint: 'PNG o JPG de hasta 5 MB.',
      avatar_custom_preview_alt: 'Vista previa del avatar personalizado',
      avatar_use_custom: 'Usar avatar subido',
      avatar_save_selection: 'Guardar avatar',
      security_section: 'Seguridad',
      current_password_label: 'Contraseña actual',
      required_for_sensitive: 'Necesaria para cambiar correo o contraseña',
      required_short: 'Obligatorio',
      current_password_placeholder: 'Introduce tu contraseña actual',
      new_password_label: 'Nueva contraseña',
      new_password_placeholder: 'Crea una contraseña segura',
      confirm_password_label: 'Confirmar nueva contraseña',
      confirm_password_placeholder: 'Repite la nueva contraseña',
      password_requirements: 'Usa al menos 10 caracteres combinando mayúsculas, minúsculas, números y símbolos.',
      save: 'Guardar',
      back: 'Volver',
      success: {
        profile_updated: 'Tu perfil se ha actualizado correctamente.',
        password_updated: 'Contraseña actualizada correctamente.',
        no_changes: 'No hay cambios que guardar.',
        email_verification_sent: 'Hemos enviado un correo de verificación a {email}. Revisa tu bandeja.'
      },
      errors: {
        password_required: 'Introduce una nueva contraseña.',
        password_mismatch: 'Las contraseñas no coinciden.',
        password_strength: 'La contraseña no cumple los requisitos de seguridad.',
        missing_current_password: 'Introduce tu contraseña actual para continuar.',
        invalid_current_password: 'La contraseña actual no es correcta.',
        too_many_attempts: 'Demasiados intentos. Inténtalo de nuevo más tarde.',
        requires_recent_login: 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
        email_in_use: 'Ya existe una cuenta con este correo electrónico.',
        custom_avatar_invalid: 'Selecciona un archivo PNG o JPG de hasta 5 MB.',
        generic: 'No se pudo actualizar el perfil. Inténtalo de nuevo.'
      },
      delete: {
        title: 'Zona de peligro',
        description: 'Elimina tu cuenta y todos los datos de partidas, avatares y triunfos asociados.',
        playful_warning:
          'Si confirmas, todas las partidas épicas, las risas compartidas y esas noches con lobos domesticados desaparecerán para siempre. Nunca digas que no te avisamos.',
        button: 'Eliminar mi cuenta',
        modal_title: 'Eliminar cuenta',
        modal_hint: 'Esta acción elimina para siempre tu perfil y los datos relacionados.',
        modal_warning: '¿Seguro que quieres hacerlo? Cuando los lobos olvidan tus chistes, no los recuerdan jamás.',
        confirm_label: 'Escribe “{code}” para confirmar.',
        confirm_placeholder: 'Introduce {code}',
        confirm_code: 'ELIMINAR',
        password_label: 'Contraseña actual',
        password_placeholder: 'Introduce tu contraseña actual',
        confirm_button: 'Sí, eliminarlo todo',
        success: 'Tu cuenta ha sido eliminada. ¡Gracias por las historias!',
        errors: {
          code_mismatch: 'Escribe exactamente “{code}” para confirmar.',
          missing_password: 'Introduce tu contraseña actual para eliminar la cuenta.',
          requires_recent_login: 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
          generic: 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.'
        }
      }
    },
    configure: {
      title: 'Configurar',
      heading: 'Configurar',
      intro: 'Ajusta la sesión antes de compartirla con los jugadores.',
      properties_title: 'Propiedades de la partida',
      selection_title: 'Selección de roles',
      selection_hint: 'Ajusta cuántos roles provienen de cada grupo. Activa el override para ignorar el reparto sugerido.',
      selection_placeholder: 'Roles de esta categoría',
      selection_placeholder_hint: 'Muy pronto verás cada rol con su ilustración.',
      selection_counts: '{selected}/{required} seleccionados',
      selection_counts_unbound: '{selected} seleccionados',
      description_label: 'Descripción de la sesión',
      description_placeholder: 'Comparte qué pueden esperar los jugadores…',
      description_hint: 'Se mostrará a los jugadores en la sala de espera.',
      title_label: 'Título de la sesión',
      title_placeholder: 'Nombre para la partida…',
      ruleset_label: 'Conjunto de reglas',
      players_label: 'Jugadores',
      balance_label: 'Role mix',
      balance_roles: {
        villagers: 'Aldeanos',
        ambiguous: 'Ambiguos',
        loners: 'Forasteros',
        werewolves: 'Hombres lobo'
      },
      role_selector_label: 'Selector de roles',
      role_override_label: 'Ignorar límites',
      role_limit: 'Máx. {count}',
      role_limit_unset: 'Sin límite',
      role_override_active: 'Ignorando límites',
      role_constraints: {
        ruleset: 'Reglas: {value}',
        mix: 'Mezcla sugerida para {value} jugadores'
      },
      session_stats_label: 'Indicadores de la sesión',
      players_counters_heading: 'Contadores de jugadores',
      expected_label: 'Esperados',
      connected_label: 'Conectados',
      ready_label: 'Listos',
      start_disabled_hint: 'Debes tener a todos los jugadores esperados conectados y listos antes de empezar.',
      btn_properties: 'Propiedades',
      btn_selection: 'Roles',
      btn_match: 'Emparejar',
      btn_distribution: 'Distribución',
      btn_share: 'Compartir sesión',
      btn_edit_selection: 'Seleccionar roles',
      start_button: 'Empezar partida',
      continue_button: 'Continuar',
      director_label: 'Narrador',
      language_label: 'Idioma del asistente',
      assist_label: 'Asistencia IA',
      assist_no_tasks: 'Todavía no hay tareas de asistencia disponibles.',
      assist_tasks: {
        roles_selection: 'Selección de roles en juego',
        roles_matching: 'Emparejar roles con jugadores',
        introduction: 'Introducción narrativa de la partida',
        night: 'Dirección de las noches',
        day: 'Dirección de los días',
        votes: 'Arbitrio de las votaciones',
        execution: 'Narración de las ejecuciones',
        summary: 'Resúmenes diarios',
        logbook: 'Cuaderno de bitácora'
      },
      match_title: 'Asignar roles',
      match_hint: 'Asigna cada rol seleccionado a un jugador o deja que el sistema lo reparta por ti.',
      match_players_title: 'Jugadores conectados',
      match_roles_title: 'Rol asignado',
      match_no_players: 'Todavía no hay jugadores conectados.',
      match_no_roles: 'Primero selecciona roles para poder asignarlos.',
      match_unassigned: 'Sin asignar',
      match_status_ready: 'Listo',
      match_status_connected: 'Conectado',
      match_auto: 'Asignar automáticamente',
      match_manual: 'Asignar manualmente',
      distribution_title: 'Distribución',
      distribution_hint: 'Próximamente: arrastra las fichas para organizar la mesa narrativa.',
      share_title: 'Compartir sesión',
      share_hint: 'Comparte este código o su QR para que los jugadores se unan.',
      share_qr_placeholder: 'QR disponible en breve',
      share_qr_generating: 'Generando QR…',
      share_qr_alt: 'Código QR de la sesión',
      role_preview_empty: 'Aún no seleccionaste roles',
      back: 'Volver al panel',
      save: 'Guardar',
      saved: 'Guardado',
      loading: 'Cargando configuración…',
      errors: {
        missing_title: 'Escribe un título para la sesión.',
        missing_session: 'No hay ninguna sesión seleccionada.',
        missing_game_id: 'Genera o introduce un Game ID antes de compartir.',
        share_unavailable: 'Completa la selección de roles antes de compartir.',
        save_failed: 'No pudimos guardar la configuración. Intenta de nuevo.',
        share_failed: 'No pudimos marcar la sesión como compartida.',
        start_failed: 'No pudimos actualizar el estado de la sesión.',
        load_failed: 'No pudimos cargar esta sesión.',
        start_requirements: 'Necesitas {expected} jugadores conectados y listos antes de empezar.'
      }
    },
    verify: {
      title: 'Verificación de correo',
      checking_title: 'Verificando el correo…',
      checking_message: 'Estamos confirmando tu enlace de verificación. Un momento…',
      success_title: 'Correo verificado',
      success_message: '¡Gracias! {email} ha quedado verificado correctamente.',
      success_hint: 'Tu cuenta ya está activa. Puedes iniciar sesión cuando quieras.',
      success_redirect: 'Te estamos llevando al login…',
      unknown_email: 'tu correo',
      invalid_title: 'Enlace de verificación inválido',
      invalid_message: 'No pudimos leer el enlace de verificación. Solicita uno nuevo desde tu perfil.',
      error_title: 'No pudimos verificar tu correo',
      error_message: 'No se pudo completar la verificación. {reason}',
      error_invalid_code: 'El código de verificación no es válido o ya se ha usado.',
      error_expired_code: 'El enlace de verificación ha caducado.',
      error_generic_reason: 'Solicita un nuevo correo de verificación y vuelve a intentarlo.',
      go_login: 'Volver al login'
    },
    player: {
      choose_title: 'Choose',
      join_methods: 'Elige cómo unirte',
      join_intro: 'Escanea un código QR, escribe un ID de sesión o selecciona una partida activa.',
      scan_qr: 'Escanear código QR',
      session_id: 'ID de partida',
      session_id_placeholder: 'Introduce el ID de partida',
      session_id_hint: 'Encontrarás este código en la pantalla del narrador.',
      connect: 'Conectar',
      connect_selected: 'Conectar con la partida seleccionada',
      active_sessions: 'Partidas disponibles',
      active_sessions_hint: 'Aquí aparecen las partidas que el narrador ha compartido.',
      refresh: 'Actualizar',
      loading: 'Cargando partidas…',
      no_sessions: 'No hay partidas disponibles ahora mismo.',
      load_error: 'No se pudo cargar la lista de partidas.',
      invalid_id: 'No encontramos una partida con ese ID.',
      connect_error: 'No se pudo conectar a la partida. Inténtalo de nuevo.',
      created_at: 'Creada',
      updated_at: 'Actualizada',
      errors: {
        session_full: 'Esta sesión ya alcanzó el máximo de jugadores.',
        session_unavailable: 'Solo puedes unirte a sesiones compartidas, en espera o en curso.',
        missing_player: 'No pudimos identificar tu perfil de jugador.',
        generic: 'No pudimos conectar con la sesión. Inténtalo de nuevo.'
      },
      waiting: {
        heading: 'Esperando',
        title: 'En espera',
        subtitle: 'Permanece atento mientras el Narrador prepara la historia.',
        description_title: 'Sobre esta sesión',
        description_empty: 'El Narrador aún no ha compartido una descripción.',
        roles_title: 'Roles en juego',
        roles_empty: 'Los roles aparecerán aquí cuando el Narrador termine de configurar la partida.',
        roles_count: '{count} roles seleccionados',
        players_title: 'Jugadores',
        players_empty: 'Aún no hay otros jugadores conectados.',
        ready_connected: 'Conectado',
        ready_ready: 'Listo',
        ready_hint: 'Marca que estás listo cuando quieras empezar.',
        ready_mark: 'Listo',
        ready_cancel: 'Cancelar',
        leave_room: 'Salir de la sala',
        chat_title: 'Chat',
        chat_placeholder: 'Envía un mensaje corto',
        chat_empty: 'Aún no hay mensajes. ¡Saluda!',
        chat_send: 'Enviar',
        chat_sending: 'Enviando…',
        chat_error: 'No pudimos enviar tu mensaje.',
        join_full: 'Esta sesión ya alcanzó el número esperado de jugadores.',
        join_unavailable: 'Esta sesión ya no está disponible.'
      }
    },
    landing: {
      current: {
        heading: 'Partida actual',
        subtitle: 'Gestiona o reanuda la partida del narrador que está en curso.',
        checking: 'Comprobando partida actual…',
        active_prefix: 'Partida activa:',
        no_active: 'No hay partidas activas ahora mismo.',
        create: 'Crear nueva partida',
        creating: 'Creando…',
        create_error: 'No pudimos crear la partida. Revisa la consola.',
        load_error: 'No pudimos cargar la partida actual.',
        view: 'Ver partida actual',
        view_forbidden: 'Solo puedes abrir partidas que hayas creado.'
      },
      history: {
        title: 'Histórico',
        subtitle: 'Consulta las sesiones creadas y sus resultados.',
        search_placeholder: 'Buscar por título, estado o ganador…',
        loading: 'Cargando…',
        error_prefix: 'Error',
        load_failed: 'No pudimos cargar el histórico.',
        empty: 'No hay sesiones registradas.',
        empty_with_query: 'No hay resultados para “{query}”.',
        delete_forbidden: 'Solo puedes eliminar partidas que hayas creado tú.',
        delete_failed: 'No pudimos borrar la partida. Inténtalo de nuevo.',
        delete_modal_title: 'Eliminar sesión',
        delete_modal_message: '¿Está usted seguro de querer borrar esta sesión de juego? Tenga en cuenta que si borra los datos ahora, más tarde no los podrá recuperar.',
        delete_modal_prompt: 'Escriba “{word}” para confirmar que desea eliminar la sesión.',
        delete_modal_placeholder: 'Escriba {word}',
        delete_modal_confirm: 'Eliminar',
        delete_modal_cancel: 'Cancelar',
        delete_modal_word: 'delete'
      },
      footbar: {
        signature: '@chatgpt-juarnamon propiedad intelectual',
        aria_label: 'Pie de aplicación'
      }
    },
    history: {
      headers: {
        title: 'Título',
        num_players: 'N.º jugadores',
        winners: 'Ganador/es',
        date: 'Fecha',
        status: 'Estado',
        actions: 'Acciones'
      }
    },
    status: {
      draft: 'Borrador',
      shared: 'Compartida',
      waiting: 'En espera',
      in_progress: 'En curso',
      paused: 'Pausada',
      finished: 'Terminada',
      cancelled: 'Cancelada'
    },
    session: {
      title: 'Sesión',
      distribution: {
        label: 'Distribución',
        title: 'Sesión #{id}',
        hint: 'Arrastra las fichas para organizar la mesa',
        fullscreen: 'Pantalla completa',
        exit_fullscreen: 'Salir de pantalla completa'
      },
      phases: {
        label: 'Orden de llamadas',
        current: 'Fase actual',
        preparation: { title: 'Preparación', subtitle: 'Montaje inicial' },
        first_night: { title: 'Primera noche', subtitle: 'Llamadas iniciales' },
        first_day: { title: 'Primer día', subtitle: 'Primera jornada' },
        each_night: { title: 'Cada noche', subtitle: 'Orden estándar' },
        each_day: { title: 'Cada día', subtitle: 'Acciones diurnas' },
        hunter: { title: 'Cazador', subtitle: '' },
        sheriff: { title: 'Alguacil', subtitle: '' },
        end: { title: 'Fin', subtitle: '' },
        steps: {
          cards_dealt: 'Se reparten las cartas de rol',
          prejudiced_manipulator: 'El pueblo se divide para el Manipulador Prejuicioso',
          gypsy_cards: 'Cartas de la Gitana (si está en juego)',
          town_crier_cards: 'Cartas del Pregonero (si está en juego)',
          thief_cards: 'El Ladrón recibe cartas extra',
          actor_cards: 'El Actor recibe tres cartas',
          sheriff_election: 'Elección del Sheriff (puede ser más tarde)',
          thief: 'Actúa el Ladrón',
          actor: 'El Actor decide su carta',
          cupid: 'Cupido elige amantes',
          seer: 'La Vidente actúa',
          fox: 'El Zorro actúa',
          lovers: 'Los amantes se reconocen',
          wandering_judge: 'El Juez Errante fija señal',
          sisters: 'Las Dos Hermanas abren los ojos',
          brothers: 'Los Tres Hermanos abren los ojos',
          wild_child: 'El Niño Salvaje elige modelo',
          bear_tamer: 'El Domador gruñe si hay hombre lobo cerca',
          scandalmonger: 'El Chismoso actúa',
          pyromaniac: 'El Pirómano actúa',
          defender: 'El Defensor protege a un jugador',
          werewolves: 'Actúan los Hombres Lobo (la Niña puede espiar)',
          baker: 'El Panadero abre y cierra los ojos',
          cursed_wolf_father: 'El Lobo Embrujado puede infectar',
          big_bad_wolf: 'El Gran Lobo Feroz actúa',
          witch: 'La Bruja decide curar/envenenar',
          gypsy: 'La Gitana puede elegir Médium',
          piper: 'El Flautista encanta jugadores',
          charmed: 'Los encantados actúan',
          actor_night: 'El Actor (si quedan cartas)',
          white_werewolf: 'El Hombre Lobo Blanco actúa (noches alternas)',
          victims: 'Se revelan las víctimas y sus efectos',
          bear_grunt: 'Gruñido del oso',
          medium: 'Médium (elegido por la Gitana)',
          town_crier: 'Interviene el Pregonero',
          debate: 'Debate y acusaciones',
          vote: 'Votación (revisar Sirviente Devoto)',
          angel: 'Ángel puede ganar (si cae en la primera votación)',
          second_vote: 'Posible segunda votación (Juez Errante)'
        }
    },
    progress: {
      default_label: 'Progreso',
      phase_label: 'Fase {current}/{total}'
    },
    victory: {
      label: 'Condiciones de victoria',
      subtitle: 'Marca cuando se cumpla alguna para habilitar Finalizar',
      village: 'Gana el pueblo (sin Hombres Lobo)',
      werewolves: 'Ganan los lobos (paridad alcanzada)',
      lovers: 'Ganan los amantes (solo ellos vivos)',
      piper: 'Gana el Flautista (todos encantados)',
      angel: 'Gana el Ángel (eliminado en la primera votación/noche)',
      draw: 'Empate / cancelada'
    },
    logbook: {
      label: 'Cuaderno de bitácora',
      placeholder: 'Anota lo que sucede para el resumen y correos…',
      add_entry: 'Añadir entrada',
      empty: 'Aún no hay entradas.',
      entry_label: 'Entrada #{num}',
      actor_becomes: 'El Comediante se convierte en {role} esta noche'
      },
      controls: {
        previous: 'Anterior',
        next: 'Siguiente',
        evaluate_phase: 'Evaluar fase',
        finish: 'Finalizar',
        cancel: 'Cancelar',
        fullscreen: 'Pantalla completa',
        exit_fullscreen: 'Salir de pantalla completa'
      },
      sheriff: {
        assigned: 'Alguacil asignado',
        lost: 'Insignia del Alguacil perdida'
      },
      fox: {
        modal_title: 'El Zorro detecta…',
        option: {
          werewolf: 'Hombre lobo',
          villager: 'Aldeano'
        },
        log: {
          werewolf: 'El Zorro detecta a un hombre lobo cercano',
          villager: 'El Zorro no detecta hombres lobo'
        }
      }
    },
    app: {
      placeholders: {
        configure_title: 'Configuración de partida',
        session_title: 'Sesión en curso',
        session_id: 'ID de partida: {id}'
      }
    }
  },
  hu: {
    common: {
      app_name: 'Falusi Mesemondó',
      untitled: 'Névtelen',
      untitled_session: 'Névtelen játék',
      loading: 'Betöltés…',
      error_prefix: 'Hiba',
      languages: {
        en: 'angol',
        es: 'spanyol',
        hu: 'magyar'
      },
      actions: {
        view: 'Megtekintés',
        edit: 'Szerkesztés',
        delete: 'Törlés',
        cancel: 'Mégse',
        save: 'Mentés',
        close: 'Bezárás',
        done: 'Kész'
      },
      alerts: {
        default_title: 'Ellenőrizd az adatokat'
      }
    },
    topbar: {
      title: 'Mesemondó vezérlőpult',
      language_label: 'Nyelv',
      change_language: 'Nyelv módosítása',
      change_language_current: 'Nyelv módosítása, aktuális: {language}',
      navigation_label: 'Fő navigáció',
      session_status_label: 'Játék állapota',
      menu: {
        profile: 'Felhasználói profil',
        logout: 'Kijelentkezés'
      }
    },
    navigation: {
      back_to_login: 'Vissza a bejelentkezéshez',
      back_to_dashboard: 'Vissza a vezérlőpulthoz'
    },
    header: {
      title: 'A falu mesemondója',
      logo_alt: 'Village Storyteller logó'
    },
    login: {
      title: 'Bejelentkezés',
      storytellers: 'Mesemondók',
      players: 'Játékosok',
      choose_role: 'Válaszd ki, hogyan szeretnél belépni',
      registration_cta: 'Regisztráció',
      form: {
        section_label: 'Lépj be e-maillel',
        email_label: 'E-mail',
        email_placeholder: 'te@pelda.hu',
        password_label: 'Jelszó',
        password_placeholder: 'Írd be a jelszavad',
        submit: 'Bejelentkezés',
        forgot: 'Elfelejtetted a jelszavad?',
        role_label: 'Belépés módja',
        roles: {
          storyteller: 'Mesemondó',
          player: 'Játékos'
        },
        register_prompt: 'Még nincs fiókod?',
        register_link: 'Regisztrálj itt',
        errors: {
          missing_email: 'Add meg az e-mail címed.',
          invalid_email: 'Adj meg érvényes e-mail címet.',
          missing_password: 'Add meg a jelszavad.',
          invalid_credentials: 'Hibás e-mail vagy jelszó.',
          email_not_verified: 'Kérjük, erősítsd meg az e-mail címed, mielőtt belépsz.',
          account_inactive: 'A fiókod inaktív. Ellenőrizd az e-mailjeidet a megerősítő linkért vagy keresd a támogatást.',
          account_disabled: 'Ez a fiók le van tiltva. Vedd fel a kapcsolatot a támogatással.',
          too_many_attempts: 'Túl sok próbálkozás. Próbáld később.',
          generic: 'A bejelentkezés nem sikerült. Próbáld újra.'
        },
        success: {
          reset_link_sent: 'Ha létezik a cím, elküldtük a helyreállító e-mailt.'
        }
      }
    },
    registration: {
      title: 'Regisztráció',
      intro: 'Töltsd ki az űrlapot a fiók létrehozásához.',
      alert_title: 'Töltsd ki a hiányzó adatokat',
      name_label: 'Teljes név',
      name_placeholder: 'Kovács Anna',
      alias_label: 'Becenév',
      alias_placeholder: 'Választható becenév',
      avatar_label: 'Avatar',
      avatar_help: 'Válassz a galériából vagy tölts fel sajátot.',
      avatar_change_button: 'Avatar módosítása',
      avatar_selected_alt: 'Kiválasztott avatar',
      avatar_modal_title: 'Válaszd ki az avatarod',
      avatar_modal_help: 'Válassz a rendelkezésre álló avatarok közül a profilodhoz.',
      avatar_option: {
        default: 'Alapértelmezett',
        andrea: 'Andrea',
        attila: 'Attila',
        geri: 'Geri',
        giuliano: 'Giuliano',
        laura: 'Laura',
        martin: 'Martin',
        mate: 'Mate',
        matyas: 'Mátyás',
        emese: 'Emese',
        natalia: 'Natalia',
        ramon: 'Ramón',
        sarolta: 'Sarolta',
        sofia: 'Sofia',
        timea: 'Tímea'
      },
      avatar_custom_label: 'Tölts fel saját avatárt',
      avatar_custom_hint: 'Legfeljebb 5 MB-os PNG vagy JPG fájl.',
      avatar_custom_preview_alt: 'Egyéni avatar előnézete',
      avatar_use_custom: 'Saját avatar használata',
      optional: 'opcionális',
      email_label: 'E-mail cím',
      email_placeholder: 'te@pelda.hu',
      password_label: 'Jelszó',
      password_requirements: 'Használj legalább 10 karaktert nagybetűkkel, kisbetűkkel, számokkal és szimbólumokkal.',
      password_placeholder: 'Adj meg biztonságos jelszót',
      confirm_password_label: 'Jelszó megerősítése',
      confirm_password_placeholder: 'Ismételd meg a jelszót',
      submit: 'Fiók létrehozása',
      back_to_login: 'Vissza a bejelentkezéshez',
      success: {
        verification_sent: 'Ellenőrző e-mailt küldtünk a következő címre: {email}. Kérjük, nézd meg a postaládádat.'
      },
      errors: {
        registration_error: 'A regisztráció nem sikerült. Próbáld újra.',
        missing_name: 'Add meg a teljes neved.',
        missing_email: 'Add meg az e-mail címed.',
        invalid_email: 'Adj meg érvényes e-mail címet.',
        missing_password: 'Adj meg egy jelszót.',
        missing_confirm: 'Erősítsd meg a jelszavad.',
        password_mismatch: 'A jelszavak nem egyeznek.',
        password_strength: 'A jelszó nem felel meg a biztonsági követelményeknek.',
        email_in_use: 'Ezzel az e-mail címmel már létezik fiók.',
        custom_avatar_invalid: 'PNG vagy JPG fájlt válassz legfeljebb 5 MB méretig.'
      }
    },
    profile: {
      title: 'Profil',
      intro: 'Frissítsd a fiókadataidat és a biztonsági beállításokat.',
      status: {
        active: 'Fiók aktív',
        inactive: 'Fiók inaktív',
        pending_verification: 'Erősítsd meg az e-mail címedet a fiók aktiválásához.'
      },
      name_label: 'Teljes név',
      name_placeholder: 'Kovács Anna',
      alias_label: 'Becenév',
      alias_placeholder: 'Választható becenév',
      optional: 'opcionális',
      email_label: 'E-mail cím',
      email_placeholder: 'te@pelda.hu',
      email_hint: 'Az e-mail módosítása az új cím megerősítését igényli.',
      avatar_label: 'Avatar',
      avatar_hint: 'Válassz a galériából vagy tölts fel sajátot.',
      avatar_change_button: 'Avatar módosítása',
      avatar_current_alt: 'Kiválasztott avatar',
      avatar_modal_title: 'Válassz új avatart',
      avatar_modal_help: 'Válassz a rendelkezésre álló avatarok közül, vagy tölts fel saját képet.',
      avatar_custom_label: 'Saját avatar feltöltése',
      avatar_custom_hint: 'PNG vagy JPG legfeljebb 5 MB méretben.',
      avatar_custom_preview_alt: 'Egyéni avatar előnézete',
      avatar_use_custom: 'Saját avatar használata',
      avatar_save_selection: 'Avatar mentése',
      security_section: 'Biztonság',
      current_password_label: 'Jelenlegi jelszó',
      required_for_sensitive: 'Szükséges az e-mail vagy jelszó módosításához',
      required_short: 'Kötelező',
      current_password_placeholder: 'Írd be a jelenlegi jelszavad',
      new_password_label: 'Új jelszó',
      new_password_placeholder: 'Adj meg biztonságos új jelszót',
      confirm_password_label: 'Új jelszó megerősítése',
      confirm_password_placeholder: 'Ismételd meg az új jelszót',
      password_requirements: 'Használj legalább 10 karaktert nagybetűkkel, kisbetűkkel, számokkal és szimbólumokkal.',
      save: 'Változtatások mentése',
      back: 'Vissza',
      success: {
        profile_updated: 'A profilod frissült.',
        password_updated: 'A jelszót sikeresen frissítettük.',
        no_changes: 'Nincs menteni való módosítás.',
        email_verification_sent: 'Ellenőrző e-mailt küldtünk a következő címre: {email}.'
      },
      errors: {
        password_required: 'Adj meg egy új jelszót.',
        password_mismatch: 'A jelszavak nem egyeznek.',
        password_strength: 'A jelszó nem felel meg a biztonsági követelményeknek.',
        missing_current_password: 'Add meg a jelenlegi jelszavad a folytatáshoz.',
        invalid_current_password: 'A jelenlegi jelszó nem helyes.',
        too_many_attempts: 'Túl sok próbálkozás. Próbáld később.',
        requires_recent_login: 'Biztonsági okokból jelentkezz be újra, majd próbáld meg ismét.',
        email_in_use: 'Ezzel az e-mail címmel már létezik fiók.',
        custom_avatar_invalid: 'PNG vagy JPG fájlt válassz legfeljebb 5 MB méretig.',
        generic: 'Nem sikerült frissíteni a profilt. Próbáld újra.'
      },
      delete: {
        title: 'Veszélyzóna',
        description: 'Töröld a fiókodat és az összes hozzá tartozó játékadatot, avatárt és dicsőséget.',
        playful_warning:
          'Ha folytatod, minden közös nevetés, farkas-szelídítő kaland és emlék ködbe vész. A horda nem ad vissza semmit.',
        button: 'Fiók törlése',
        modal_title: 'Fiók törlése',
        modal_hint: 'Ez a művelet véglegesen eltávolítja a profilodat és a kapcsolódó adatokat.',
        modal_warning: 'Biztos vagy benne? Ha a farkasok elfelejtik a poénjaidat, sosem emlékeznek vissza.',
        confirm_label: 'Írd be a következőt a megerősítéshez: „{code}”.',
        confirm_placeholder: 'Írd be: {code}',
        confirm_code: 'TÖRLÉS',
        password_label: 'Jelenlegi jelszó',
        password_placeholder: 'Írd be a jelenlegi jelszavad',
        confirm_button: 'Igen, mindent törlök',
        success: 'A fiókodat töröltük. Köszönjük a történeteket!',
        errors: {
          code_mismatch: 'Pontosan írd be: „{code}”.',
          missing_password: 'Add meg a jelenlegi jelszavad a törléshez.',
          requires_recent_login: 'Biztonsági okból jelentkezz be újra, majd próbáld meg ismét.',
          generic: 'Nem tudtuk törölni a fiókot. Próbáld meg újra.'
        }
      }
    },
    configure: {
      title: 'Konfigurálás',
      heading: 'Konfigurálás',
      intro: 'Állítsd be a játék részleteit, mielőtt megosztod a játékosokkal.',
      properties_title: 'Játék beállításai',
      selection_title: 'Szerepkiosztás',
      selection_hint: 'Állítsd be, hány szerep jön az egyes kategóriákból. A korlát feloldásával figyelmen kívül hagyhatod az ajánlást.',
      selection_placeholder: 'Szerepek ebből a csoportból',
      selection_placeholder_hint: 'Hamarosan itt lesznek a tényleges kártyák.',
      selection_counts: '{selected}/{required} kiválasztva',
      selection_counts_unbound: '{selected} kiválasztva',
      description_label: 'Session leírása',
      description_placeholder: 'Írd le röviden, mire számíthatnak a játékosok…',
      description_hint: 'Ezt a szöveget a váróban látják majd a játékosok.',
      title_label: 'Játék címe',
      title_placeholder: 'Add meg a játék nevét…',
      ruleset_label: 'Szabálykészlet',
      players_label: 'Játékosok száma',
      balance_label: 'Szereparány',
      balance_roles: {
        villagers: 'Falusiak',
        ambiguous: 'Átmeneti szerepek',
        loners: 'Kívülállók',
        werewolves: 'Farkasok'
      },
      role_selector_label: 'Szerepek kiosztása',
      role_override_label: 'Korlátok feloldása',
      role_limit: 'Max. {count}',
      role_limit_unset: 'Nincs limit',
      role_override_active: 'Feloldva',
      role_constraints: {
        ruleset: 'Szabálykészlet: {value}',
        mix: 'Ajánlott mix {value} játékoshoz'
      },
      session_stats_label: 'Session mutatók',
      players_counters_heading: 'Játékos számlálók',
      expected_label: 'Tervezett',
      connected_label: 'Csatlakozott',
      ready_label: 'Kész',
      start_disabled_hint: 'A kezdés előtt minden várt játékosnak csatlakoznia kell és készen kell állnia.',
      btn_properties: 'Tulajdonságok',
      btn_selection: 'Szerepek',
      btn_match: 'Párosítás',
      btn_distribution: 'Elrendezés',
      btn_share: 'Megosztás',
      btn_edit_selection: 'Szerepek kiválasztása',
      start_button: 'Játék indítása',
      continue_button: 'Folytatás',
      director_label: 'Mesemondó',
      language_label: 'Asszisztens nyelve',
      assist_label: 'AI asszisztencia',
      assist_no_tasks: 'Még nincsenek elérhető asszisztens feladatok.',
      assist_tasks: {
        roles_selection: 'Szerepek kiválasztása',
        roles_matching: 'Szerepek kiosztása játékosokra',
        introduction: 'Narratív bevezető',
        night: 'Éjszakai fázis vezetése',
        day: 'Nappali fázis vezetése',
        votes: 'Szavazások felügyelete',
        execution: 'Kivégzések narrálása',
        summary: 'Napi összefoglalók',
        logbook: 'Napló vezetése'
      },
      match_title: 'Szerepek kiosztása',
      match_hint: 'Oszt szét minden szerepet kézzel vagy kérj automatikus kiosztást.',
      match_players_title: 'Csatlakozott játékosok',
      match_roles_title: 'Hozzárendelt szerep',
      match_no_players: 'Még nincs csatlakozott játékos.',
      match_no_roles: 'Előbb válassz szerepeket a kiosztáshoz.',
      match_unassigned: 'Nincs kiosztva',
      match_status_ready: 'Kész',
      match_status_connected: 'Csatlakozott',
      match_auto: 'Automatikus kiosztás',
      match_manual: 'Kézi kiosztás',
      distribution_title: 'Elrendezés',
      distribution_hint: 'Hamarosan: húzd a szerepkorongokat, hogy lásd az egész elrendezést.',
      share_title: 'Session megosztása',
      share_hint: 'Oszd meg ezt a kódot vagy a QR-t, hogy a játékosok csatlakozzanak.',
      share_qr_placeholder: 'QR hamarosan',
      share_qr_generating: 'QR készítése…',
      share_qr_alt: 'QR-kód ehhez a sessionhöz',
      role_preview_empty: 'Még nincs kiválasztott szerep',
      back: 'Vissza a vezérlőpultra',
      save: 'Mentés',
      saved: 'Mentve!',
      loading: 'Konfiguráció betöltése…',
      errors: {
        missing_title: 'Add meg a játék címét.',
        missing_session: 'Nincs kiválasztott session.',
        missing_game_id: 'Megosztás előtt hozz létre egy Game ID-t.',
        share_unavailable: 'A szerepkiosztást kell előbb befejezni.',
        save_failed: 'Nem sikerült menteni a beállításokat.',
        share_failed: 'Nem sikerült megosztani a sessiont.',
        start_failed: 'Nem tudtuk frissíteni a session állapotát.',
        load_failed: 'Nem sikerült betölteni ezt a sessiont.',
        start_requirements: '{expected} játékosnak kell csatlakoznia és készen állnia a kezdéshez.'
      }
    },
    verify: {
      title: 'E-mail megerősítés',
      checking_title: 'Ellenőrizzük az e-mailt…',
      checking_message: 'Ellenőrizzük a megerősítő linket. Kérjük, várj egy pillanatot.',
      success_title: 'E-mail megerősítve',
      success_message: 'Köszönjük! {email} mostantól megerősített.',
      success_hint: 'A fiókod aktív. Most már bejelentkezhetsz.',
      success_redirect: 'Nemsokára átirányítunk a bejelentkezéshez…',
      unknown_email: 'az e-mail címed',
      invalid_title: 'Érvénytelen megerősítő link',
      invalid_message: 'Nem sikerült beolvasni a megerősítő linket. Kérj újat a profilodból.',
      error_title: 'Nem tudtuk megerősíteni az e-mail címedet',
      error_message: 'Nem sikerült befejezni a megerősítést. {reason}',
      error_invalid_code: 'A megerősítő kód érvénytelen vagy már felhasználták.',
      error_expired_code: 'A megerősítő link lejárt.',
      error_generic_reason: 'Kérj új megerősítő e-mailt, és próbáld újra.',
      go_login: 'Vissza a bejelentkezéshez'
    },
    player: {
      choose_title: 'Choose',
      join_methods: 'Válaszd ki a csatlakozás módját',
      join_intro: 'Olvass be egy QR-kódot, írd be a session azonosítót vagy válassz egy aktív játékot.',
      scan_qr: 'QR-kód beolvasása',
      session_id: 'Játék azonosító',
      session_id_placeholder: 'Írd be a játék azonosítót',
      session_id_hint: 'A kódot a mesélő képernyőjén találod.',
      connect: 'Csatlakozás',
      connect_selected: 'Csatlakozás a kiválasztott játékhoz',
      active_sessions: 'Elérhető játékok',
      active_sessions_hint: 'Itt jelennek meg a mesélő által megosztott játékok.',
      refresh: 'Frissítés',
      loading: 'Játékok betöltése…',
      no_sessions: 'Jelenleg nincs elérhető játék.',
      load_error: 'Nem sikerült betölteni a játékokat.',
      invalid_id: 'Nem található ilyen azonosítójú játék.',
      connect_error: 'Nem sikerült csatlakozni a játékhoz. Próbáld újra.',
      created_at: 'Létrehozva',
      updated_at: 'Frissítve',
      errors: {
        session_full: 'Ez a session elérte a maximális játékosszámot.',
        session_unavailable: 'Csak megosztott, várakozó vagy futó sessionhöz csatlakozhatsz.',
        missing_player: 'Nem tudtuk azonosítani a játékos profilodat.',
        generic: 'Nem sikerült csatlakozni a sessionhöz. Próbáld újra.'
      },
      waiting: {
        heading: 'Várakozás',
        title: 'Váró',
        subtitle: 'Várj türelemmel, amíg a mesélő felkészül.',
        description_title: 'A sessionről',
        description_empty: 'A mesélő még nem adott meg leírást.',
        roles_title: 'Aktív szerepek',
        roles_empty: 'A szerepek itt jelennek meg, amint a mesélő véglegesítette a beállításokat.',
        roles_count: '{count} kiválasztott szerep',
        players_title: 'Játékosok',
        players_empty: 'Még senki más nem csatlakozott.',
        ready_connected: 'Csatlakozott',
        ready_ready: 'Kész',
        ready_hint: 'Jelöld magad késznek, amikor indulásra készen állsz.',
        ready_mark: 'Kész vagyok',
        ready_cancel: 'Mégsem',
        leave_room: 'Kilépés a váróból',
        chat_title: 'Chat',
        chat_placeholder: 'Írj egy rövid üzenetet',
        chat_empty: 'Még nincs üzenet. Köszönj a többieknek!',
        chat_send: 'Küldés',
        chat_sending: 'Küldés…',
        chat_error: 'Nem sikerült elküldeni az üzenetet.',
        join_full: 'Ez a session már elérte a várt játékosszámot.',
        join_unavailable: 'Ez a session már nem érhető el.'
      }
    },
    landing: {
      current: {
        heading: 'Aktív játék',
        subtitle: 'Kezeld vagy folytasd a mesélő éppen futó játékát.',
        checking: 'Aktuális játék ellenőrzése…',
        active_prefix: 'Aktív játék:',
        no_active: 'Jelenleg nincs aktív játék.',
        create: 'Új játék létrehozása',
        creating: 'Játék létrehozása…',
        create_error: 'Nem sikerült létrehozni a játékot. Nézd meg a konzolt.',
        load_error: 'Nem tudtuk betölteni az aktuális játékot.',
        view: 'Aktív játék megnyitása',
        view_forbidden: 'Csak az általad létrehozott játékokat nyithatod meg.'
      },
      history: {
        title: 'Előzmények',
        subtitle: 'Nézd át a korábban létrehozott játékokat és eredményeiket.',
        search_placeholder: 'Keresés cím, állapot vagy győztes alapján…',
        loading: 'Betöltés…',
        error_prefix: 'Hiba',
        load_failed: 'Nem sikerült betölteni az előzményeket.',
        empty: 'Nincsenek mentett játékok.',
        empty_with_query: 'Nincs találat erre: “{query}”.',
        delete_forbidden: 'Csak az általad létrehozott játékokat törölheted.',
        delete_failed: 'Nem sikerült törölni a játékot. Próbáld újra.',
        delete_modal_title: 'Játék törlése',
        delete_modal_message: 'Biztosan törlöd ezt a játékmenetet? Ha most törlöd, később nem tudod visszaállítani.',
        delete_modal_prompt: 'Írd be, hogy “{word}”, ezzel erősíted meg a törlést.',
        delete_modal_placeholder: 'Írd be: {word}',
        delete_modal_confirm: 'Játék törlése',
        delete_modal_cancel: 'Mégse',
        delete_modal_word: 'delete'
      },
      footbar: {
        signature: '@chatgpt-juarnamon szellemi tulajdona',
        aria_label: 'Alkalmazás lábléc'
      }
    },
    history: {
      headers: {
        title: 'Cím',
        num_players: 'Játékosok száma',
        winners: 'Győztes(ek)',
        date: 'Dátum',
        status: 'Állapot',
        actions: 'Műveletek'
      }
    },
    status: {
      draft: 'Piszkozat',
      shared: 'Megosztva',
      waiting: 'Várakozik',
      in_progress: 'Folyamatban',
      paused: 'Szünetel',
      finished: 'Befejezve',
      cancelled: 'Törölve'
    },
    session: {
      title: 'Játék',
      distribution: {
        label: 'Elhelyezés',
        title: 'Játék #{id}',
        hint: 'Húzd a zsetonokat a táblán',
        fullscreen: 'Teljes képernyő',
        exit_fullscreen: 'Kilépés a teljes képernyőből'
      },
      phases: {
        label: 'Fázis sorrend',
        current: 'Aktuális fázis',
        preparation: { title: 'Előkészítés', subtitle: 'Kezdeti lépések' },
        first_night: { title: 'Első éjszaka', subtitle: 'Első hívások' },
        first_day: { title: 'Első nap', subtitle: 'Első nappali kör' },
        each_night: { title: 'Minden éjszaka', subtitle: 'Alap sorrend' },
        each_day: { title: 'Minden nap', subtitle: 'Nappali akciók' },
        hunter: { title: 'Vadász', subtitle: '' },
        sheriff: { title: 'Seriff', subtitle: '' },
        end: { title: 'Vége', subtitle: '' },
        steps: {
          cards_dealt: 'Szerepkártyák kiosztása',
          prejudiced_manipulator: 'Falu kettéosztása az Előítéletes Manipulátorhoz',
          gypsy_cards: 'Cigány kártyák (ha játékban van)',
          town_crier_cards: 'Kikiáltó kártyái (ha játékban van)',
          thief_cards: 'A Tolvaj extra kártyákat kap',
          actor_cards: 'A Színész három kártyát kap',
          sheriff_election: 'Seriff választás (lehet később is)',
          thief: 'A Tolvaj lép',
          actor: 'A Színész dönt a kártyáról',
          cupid: 'Ámor szerelmeseket választ',
          seer: 'A Jósnő lép',
          fox: 'A Róka lép',
          lovers: 'A szerelmesek felismerik egymást',
          wandering_judge: 'A Vándor Bíró jelet ad',
          sisters: 'A Két Nővér kinyitja a szemét',
          brothers: 'A Három Fivér kinyitja a szemét',
          wild_child: 'A Vadgyerek példaképet választ',
          bear_tamer: 'A Medvetáncoltató morgása',
          scandalmonger: 'A Pletykafészek lép',
          pyromaniac: 'A Pirotechnikus lép',
          defender: 'A Védelmező megóv valakit',
          werewolves: 'Farkasok lépnek (a Kislány leshet)',
          baker: 'A Pék kinyitja majd becsukja a szemét',
          cursed_wolf_father: 'Az Elátkozott Farkasapa megfertőzhet',
          big_bad_wolf: 'A Nagy Farkas lép',
          witch: 'A Boszorkány gyógyít/mérgez',
          gypsy: 'A Cigány Médiumot választhat',
          piper: 'A Furulyás elbűvöl',
          charmed: 'Elbűvöltek lépnek',
          actor_night: 'A Színész (ha maradt kártya)',
          white_werewolf: 'A Fehér Farkas lép (minden második éjjel)',
          victims: 'Áldozatok felfedése és hatásaik',
          bear_grunt: 'Medve morgása',
          medium: 'Médium (a Cigány választása)',
          town_crier: 'A Kikiáltó megszólal',
          debate: 'Vita és vádak',
          vote: 'Szavazás (ellenőrizd a Hű Szolgát)',
          angel: 'Az Angyal nyerhet (első szavazásnál)',
          second_vote: 'Második szavazás lehetséges (Vándor Bíró)'
        }
      },
      progress: {
        default_label: 'Előrehaladás',
        phase_label: 'Fázis {current}/{total}'
      },
    victory: {
      label: 'Győzelmi feltételek',
      subtitle: 'Jelöld, ha teljesül, hogy engedélyezd a befejezést',
      village: 'Falu nyer (nincs vérfarkas)',
      werewolves: 'Farkasok nyernek (paritás)',
      lovers: 'Szerelmesek nyernek (csak ők maradnak)',
      piper: 'Furulyás nyer (mindenki elbűvölve)',
      angel: 'Angyal nyer (első szavazás/éj kiesés)',
        draw: 'Döntetlen / törölve'
      },
      logbook: {
        label: 'Napló',
        placeholder: 'Írd le, mi történik a kivonathoz és e-mailekhez…',
        add_entry: 'Bejegyzés hozzáadása',
        empty: 'Még nincs bejegyzés.',
        entry_label: 'Bejegyzés #{num}',
        actor_becomes: 'A Komikus ma éjjel {role} szerepébe lép'
      },
      controls: {
        previous: 'Előző',
        next: 'Következő',
        evaluate_phase: 'Fázis kiértékelése',
        finish: 'Befejezés',
        cancel: 'Mégse',
        fullscreen: 'Teljes képernyő',
        exit_fullscreen: 'Kilépés a teljes képernyőből'
      },
      sheriff: {
        assigned: 'Seriff kijelölve',
        lost: 'Seriff jelvény elveszett'
      },
      fox: {
        modal_title: 'A Róka szimatol…',
        option: {
          werewolf: 'Vérfarkas',
          villager: 'Falusi'
        },
        log: {
          werewolf: 'A Róka vérfarkast érez a közelben',
          villager: 'A Róka nem érez vérfarkast'
        }
      }
    },
    app: {
      placeholders: {
        configure_title: 'Játék beállítása',
        session_title: 'Folyamatban lévő játék',
        session_id: 'Játék azonosítója: {id}'
      }
    }
  }
};

export const dictionary = writable(dictionaries);

// Utilidad para resolver una clave "a.b.c" dentro del diccionario
function resolve(obj, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

// Reemplazo de variables en cadenas: "Hola, {name}"
function interpolate(str, vars = {}) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

// Store derivado que devuelve una FUNCIÓN traductora reactiva
export const t = derived([dictionary, locale], ([$dict, $locale]) => {
  return (key, vars = {}) => {
    const pack = $dict[$locale] || $dict.es;
    const val = resolve(pack, key);
    if (val === undefined) {
      // Fallback: intenta ES → muestra la clave si no existe
      const fallback = resolve($dict.es, key);
      return interpolate(fallback !== undefined ? fallback : key, vars);
    }
    if (typeof val === 'string') {
      return interpolate(val, vars);
    }
    return val; // soporta objetos/arrays si alguna vez los necesitas
  };
});

// API imperativa por si la necesitas fuera de componentes
export function setLocale(next) {
  if (!availableLocales.includes(next)) return;
  locale.set(next);
}
