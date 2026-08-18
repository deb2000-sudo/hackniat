/**
 * Style hooks from the ui/ CSS modules, for the few callers that need a
 * component's classes without rendering that component.
 *
 * These live outside the .jsx files on purpose: exporting a non-component
 * alongside a component breaks React Fast Refresh
 * (react-refresh/only-export-components).
 *
 * Reach for these sparingly — rendering the component is almost always the
 * better answer. They exist for cases the component can't cover, like the
 * button skin on a file-input <label>.
 */
import buttonStyles from './Button.module.css'
import accordionStyles from './Accordion.module.css'
import modalStyles from './Modal.module.css'

export const BUTTON_VARIANTS = ['primary', 'accent', 'secondary', 'ghost', 'danger', 'success']

/** Button classes for an element <Button> can't render (a <label>, a <span>). */
export function buttonClass({ variant = 'primary', size, block = false } = {}) {
  return [
    buttonStyles.btn,
    buttonStyles[BUTTON_VARIANTS.includes(variant) ? variant : 'primary'],
    size ? buttonStyles[size] : '',
    block ? buttonStyles.block : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Accordion skin for a manual review that still needs attention. */
export const accordionManualPending = accordionStyles.manualPending

/** Wide Modal layout for the full AI analysis report dialog. */
export const modalAnalysisDetail = modalStyles.analysisDetail
