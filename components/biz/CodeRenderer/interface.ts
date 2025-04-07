export interface CodeRendererProps {
  codeRendererServer: string // url
  onFixError?: (errorMessage: string) => void
  codes: {
    [key: string]: string
  }
  className?: string
  notShowErrorToast?: boolean
  entryFile: string
  hideControls?: boolean
}
