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
        save: 'Save'
      }
    },
    topbar: {
      title: 'Storyteller Dashboard',
      language_label: 'Language',
      change_language: 'Change language',
      change_language_current: 'Change language, current: {language}',
      navigation_label: 'Top navigation',
      menu: {
        profile: 'User profile',
        logout: 'Logout'
      }
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
      name_label: 'Full name',
      name_placeholder: 'John Doe',
      alias_label: 'Nickname',
      alias_placeholder: 'Optional nickname',
      avatar_label: 'Choose an avatar',
      avatar_help: 'Select one of the avatars below.',
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
        matyas: 'Mátyás',
        natalia: 'Natalia',
        ramon: 'Ramón',
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
      email_hint: 'Changing your email will require verifying the new address.',
      avatar_label: 'Avatar',
      avatar_hint: 'Choose one of the preset avatars or upload your own.',
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
      current_password_placeholder: 'Enter your current password',
      new_password_label: 'New password',
      new_password_placeholder: 'Create a new secure password',
      confirm_password_label: 'Confirm new password',
      confirm_password_placeholder: 'Repeat the new password',
      password_requirements: 'Use at least 10 characters combining uppercase, lowercase, numbers and symbols.',
      save: 'Save changes',
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
      title: 'Session configuration',
      heading: 'Configure your new game',
      subheading: 'Adjust the basics before inviting players to join.',
      session_id: 'Session ID',
      game_code: 'Game code',
      title_label: 'Session title',
      title_placeholder: 'Game session name…',
      title_hint: 'You can change this later.',
      ruleset_label: 'Rule set',
      ruleset_hint: 'Choose the collection of roles and events available for this game.',
      players_label: 'Players',
      players_hint: 'Allowed range: {range} players.',
      director_label: 'Storyteller',
      director_hint: {
        human: 'You will handle narration and decisions manually.',
        assisted: 'The assistant can help with narration and lookup tasks.',
        ai: 'The AI will run the full session. Assistance is always enabled.'
      },
      language_label: 'Assistant language',
      language_hint: 'Only relevant when using AI assistance.',
      phase_label: 'Game phase',
      phase_hint: 'Set the current stage of the story so the assistant can follow along.',
      assist_label: 'AI assistance',
      assist_toggle: 'Enable specific assistant tasks',
      assist_no_tasks: 'No assistant tasks available yet.',
      assist_tasks_hint: 'Select the areas where the assistant should participate.',
      back: 'Back to dashboard',
      save: 'Save changes',
      saved: 'Saved!',
      loading: 'Loading configuration…'
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
      choose_title: 'Player Dashboard',
      join_methods: 'Choose how to join',
      join_intro: 'Scan a QR code, enter a session ID or pick one from the list.',
      scan_qr: 'Scan QR code',
      session_id: 'Session ID',
      session_id_placeholder: 'Enter the session ID',
      session_id_hint: 'You will find this code on the storyteller’s screen.',
      connect: 'Connect',
      connect_selected: 'Connect to selected session',
      active_sessions: 'Available sessions',
      refresh: 'Refresh',
      loading: 'Loading sessions…',
      no_sessions: 'No sessions available right now.',
      load_error: 'Unable to load sessions. Try again.',
      invalid_id: 'We could not find that session.',
      connect_error: 'Could not connect to the session. Please try again.',
      created_at: 'Created',
      updated_at: 'Updated'
    },
    landing: {
      current: {
        checking: 'Checking current game session…',
        active_prefix: 'Active game:',
        no_active: 'No active game sessions right now.',
        create: 'Create new game',
        creating: 'Creating…',
        create_error: 'We could not create the session. Please check the console logs.',
        view: 'View current game'
      },
      history: {
        title: 'History',
        search_placeholder: 'Search by title, status or winner…',
        loading: 'Loading…',
        error_prefix: 'Error',
        empty: 'There are no sessions recorded.',
        empty_with_query: 'There are no results for “{query}”.'
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
        session_id: 'Session ID: {id}'
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
        save: 'Guardar'
      }
    },
    topbar: {
      title: 'Panel del Narrador',
      language_label: 'Idioma',
      change_language: 'Cambiar idioma',
      change_language_current: 'Cambiar idioma, actual: {language}',
      navigation_label: 'Barra de navegación',
      menu: {
        profile: 'Perfil de usuario',
        logout: 'Cerrar sesión'
      }
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
      name_label: 'Nombre completo',
      name_placeholder: 'Marina Pérez',
      alias_label: 'Apodo',
      alias_placeholder: 'Apodo opcional',
      avatar_label: 'Elige un avatar',
      avatar_help: 'Selecciona uno de los avatares disponibles.',
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
        matyas: 'Mátyás',
        natalia: 'Natalia',
        ramon: 'Ramón',
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
      avatar_hint: 'Elige uno de los avatares disponibles o sube tu propia imagen.',
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
      current_password_placeholder: 'Introduce tu contraseña actual',
      new_password_label: 'Nueva contraseña',
      new_password_placeholder: 'Crea una contraseña segura',
      confirm_password_label: 'Confirmar nueva contraseña',
      confirm_password_placeholder: 'Repite la nueva contraseña',
      password_requirements: 'Usa al menos 10 caracteres combinando mayúsculas, minúsculas, números y símbolos.',
      save: 'Guardar cambios',
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
      title: 'Configuración de la sesión',
      heading: 'Configura tu nueva partida',
      subheading: 'Ajusta lo básico antes de invitar a los jugadores.',
      session_id: 'ID de sesión',
      game_code: 'Código de partida',
      title_label: 'Título de la sesión',
      title_placeholder: 'Nombre para la partida…',
      title_hint: 'Podrás cambiarlo más adelante.',
      ruleset_label: 'Conjunto de reglas',
      ruleset_hint: 'Selecciona los roles y eventos disponibles para esta partida.',
      players_label: 'Jugadores',
      players_hint: 'Rango permitido: {range} jugadores.',
      director_label: 'Narrador',
      director_hint: {
        human: 'Tú narrarás y tomarás decisiones de forma manual.',
        assisted: 'El asistente puede ayudarte con narrativa y consultas.',
        ai: 'La IA gestionará toda la sesión. La asistencia siempre estará activa.'
      },
      language_label: 'Idioma del asistente',
      language_hint: 'Solo aplica cuando usas asistencia IA.',
      phase_label: 'Fase del juego',
      phase_hint: 'Indica en qué etapa se encuentra la historia para que el asistente pueda seguirla.',
      assist_label: 'Asistencia IA',
      assist_toggle: 'Activar tareas asistidas específicas',
      assist_no_tasks: 'Todavía no hay tareas de asistencia disponibles.',
      assist_tasks_hint: 'Selecciona en qué aspectos quieres recibir ayuda.',
      back: 'Volver al panel',
      save: 'Guardar cambios',
      saved: 'Guardado',
      loading: 'Cargando configuración…'
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
      choose_title: 'Panel del Jugador',
      join_methods: 'Elige cómo unirte',
      join_intro: 'Escanea un código QR, escribe un ID de sesión o selecciona una partida activa.',
      scan_qr: 'Escanear código QR',
      session_id: 'ID de sesión',
      session_id_placeholder: 'Introduce el ID de sesión',
      session_id_hint: 'Encontrarás este código en la pantalla del narrador.',
      connect: 'Conectar',
      connect_selected: 'Conectar con la partida seleccionada',
      active_sessions: 'Partidas disponibles',
      refresh: 'Actualizar',
      loading: 'Cargando partidas…',
      no_sessions: 'No hay partidas disponibles ahora mismo.',
      load_error: 'No se pudo cargar la lista de partidas.',
      invalid_id: 'No encontramos una partida con ese ID.',
      connect_error: 'No se pudo conectar a la partida. Inténtalo de nuevo.',
      created_at: 'Creada',
      updated_at: 'Actualizada'
    },
    landing: {
      current: {
        checking: 'Comprobando partida actual…',
        active_prefix: 'Partida activa:',
        no_active: 'No hay partidas activas ahora mismo.',
        create: 'Crear nueva partida',
        creating: 'Creando…',
        create_error: 'No pudimos crear la partida. Revisa la consola.',
        view: 'Ver partida actual'
      },
      history: {
        title: 'Histórico',
        search_placeholder: 'Buscar por título, estado o ganador…',
        loading: 'Cargando…',
        error_prefix: 'Error',
        empty: 'No hay sesiones registradas.',
        empty_with_query: 'No hay resultados para “{query}”.'
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
      waiting: 'En espera',
      in_progress: 'En curso',
      paused: 'Pausada',
      finished: 'Terminada',
      cancelled: 'Cancelada'
    },
    app: {
      placeholders: {
        configure_title: 'Configuración de partida',
        session_title: 'Sesión en curso',
        session_id: 'ID de sesión: {id}'
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
        save: 'Mentés'
      }
    },
    topbar: {
      title: 'Mesemondó vezérlőpult',
      language_label: 'Nyelv',
      change_language: 'Nyelv módosítása',
      change_language_current: 'Nyelv módosítása, aktuális: {language}',
      navigation_label: 'Fő navigáció',
      menu: {
        profile: 'Felhasználói profil',
        logout: 'Kijelentkezés'
      }
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
      name_label: 'Teljes név',
      name_placeholder: 'Kovács Anna',
      alias_label: 'Becenév',
      alias_placeholder: 'Választható becenév',
      avatar_label: 'Válassz egy avatárt',
      avatar_help: 'Válaszd ki a lenti avatárok egyikét.',
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
        matyas: 'Mátyás',
        natalia: 'Natalia',
        ramon: 'Ramón',
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
      avatar_hint: 'Válassz egy avatart vagy tölts fel saját képet.',
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
      title: 'Játék konfigurációja',
      heading: 'Állítsd be az új játékot',
      subheading: 'Finomhangold az alapokat, mielőtt meghívod a játékosokat.',
      session_id: 'Session azonosító',
      game_code: 'Játék kód',
      title_label: 'Játék címe',
      title_placeholder: 'Add meg a játék nevét…',
      title_hint: 'Később bármikor módosíthatod.',
      ruleset_label: 'Szabálykészlet',
      ruleset_hint: 'Válaszd ki, milyen szerepek és események legyenek elérhetők.',
      players_label: 'Játékosok száma',
      players_hint: 'Engedélyezett tartomány: {range} játékos.',
      director_label: 'Mesemondó',
      director_hint: {
        human: 'Minden narrációt és döntést te kezelsz manuálisan.',
        assisted: 'Az asszisztens segíthet a történetben és a visszakeresésekben.',
        ai: 'Az AI vezeti a teljes játékot. A segítség mindig aktív.'
      },
      language_label: 'Asszisztens nyelve',
      language_hint: 'Csak akkor számít, ha AI-asszisztenciát használsz.',
      phase_label: 'Játékfázis',
      phase_hint: 'Állítsd be, hogy a történet melyik szakaszában jársz, így az asszisztens is tud követni.',
      assist_label: 'AI asszisztencia',
      assist_toggle: 'Konkrét asszisztens feladatok engedélyezése',
      assist_no_tasks: 'Még nincsenek elérhető asszisztens feladatok.',
      assist_tasks_hint: 'Válaszd ki, mely területeken segítsen az asszisztens.',
      back: 'Vissza a vezérlőpultra',
      save: 'Mentés',
      saved: 'Mentve!',
      loading: 'Konfiguráció betöltése…'
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
      choose_title: 'Játékos vezérlőpult',
      join_methods: 'Válaszd ki a csatlakozás módját',
      join_intro: 'Olvass be egy QR-kódot, írd be a session azonosítót vagy válassz egy aktív játékot.',
      scan_qr: 'QR-kód beolvasása',
      session_id: 'Session azonosító',
      session_id_placeholder: 'Írd be a session azonosítót',
      session_id_hint: 'A kódot a mesélő képernyőjén találod.',
      connect: 'Csatlakozás',
      connect_selected: 'Csatlakozás a kiválasztott játékhoz',
      active_sessions: 'Elérhető játékok',
      refresh: 'Frissítés',
      loading: 'Játékok betöltése…',
      no_sessions: 'Jelenleg nincs elérhető játék.',
      load_error: 'Nem sikerült betölteni a játékokat.',
      invalid_id: 'Nem található ilyen azonosítójú játék.',
      connect_error: 'Nem sikerült csatlakozni a játékhoz. Próbáld újra.',
      created_at: 'Létrehozva',
      updated_at: 'Frissítve'
    },
    landing: {
      current: {
        checking: 'Aktuális játék ellenőrzése…',
        active_prefix: 'Aktív játék:',
        no_active: 'Jelenleg nincs aktív játék.',
        create: 'Új játék létrehozása',
        creating: 'Játék létrehozása…',
        create_error: 'Nem sikerült létrehozni a játékot. Nézd meg a konzolt.',
        view: 'Aktív játék megnyitása'
      },
      history: {
        title: 'Előzmények',
        search_placeholder: 'Keresés cím, állapot vagy győztes alapján…',
        loading: 'Betöltés…',
        error_prefix: 'Hiba',
        empty: 'Nincsenek mentett játékok.',
        empty_with_query: 'Nincs találat erre: “{query}”.'
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
      waiting: 'Várakozik',
      in_progress: 'Folyamatban',
      paused: 'Szünetel',
      finished: 'Befejezve',
      cancelled: 'Törölve'
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
