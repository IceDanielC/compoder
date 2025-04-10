"use client"
import { useState, useEffect, useMemo } from "react"
import { AppHeader } from "@/components/biz/AppHeader"
import { useParams } from "next/navigation"
import { ComponentCodeVersionsContainer } from "@/components/biz/ComponentCodeVersionsContainer"
import { CodeIDE, FileNode } from "@/components/biz/CodeIDE"
import { ChatInput } from "@/components/biz/ChatInput"
import { useSidebar } from "@/components/ui/sidebar"
import { useComponentCodeDetail } from "../../server-store/selectors"
import {
  transformComponentArtifactFromXml,
  transformTryCatchErrorFromXml,
  transformFileNodeToXml,
} from "@/lib/xml-message-parser/parser"
import { Skeleton } from "@/components/ui/skeleton"
import { CodeRenderer as CodeRendererComponent } from "@/components/biz/CodeRenderer"
import { useFile } from "@/components/biz/CodeIDE/context/FileContext"
import {
  useEditComponentCode,
  useSaveComponentCode,
} from "../../server-store/mutations"
import { Prompt } from "@/lib/db/componentCode/types"
import { TldrawEdit } from "@/components/biz/TldrawEdit"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipContent } from "@/components/ui/tooltip"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CompoderThinkingLoading } from "@/components/biz/CompoderThinkingLoading"
import { CodingBox } from "@/components/biz/CodingBox"
import { useFirstLoading } from "@/hooks/use-first-loading"
import { toast } from "@/hooks/use-toast"
import { flushSync } from "react-dom"
import { AIProvider } from "@/lib/config/ai-providers"
import {
  LLMSelectorProvider,
  LLMSelectorButton,
} from "@/app/commons/LLMSelectorProvider"

export default function ComponentPage() {
  const params = useParams()
  const [activeVersion, setActiveVersion] = useState("0")
  const [images, setImages] = useState<string[]>([])
  const { setOpen } = useSidebar()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [provider, setProvider] = useState<AIProvider>()
  const [model, setModel] = useState<string>()

  // Fetch component code detail
  const {
    data: componentDetail,
    isLoading,
    refetch,
  } = useComponentCodeDetail(
    params.componentId as string,
    params.codegenId as string,
  )
  const shouldShowLoading = useFirstLoading(isLoading)

  useEffect(() => {
    setOpen(false)
  }, [])

  // Set active version to latest version when data loads
  useEffect(() => {
    if (componentDetail?.versions?.length) {
      setActiveVersion(
        componentDetail.versions[
          componentDetail.versions.length - 1
        ]._id.toString(),
      )
    }
  }, [componentDetail])

  const [chatInput, setChatInput] = useState("")
  const editMutation = useEditComponentCode()
  const saveMutation = useSaveComponentCode()

  // handle LLM change
  const handleLLMChange = (
    newProvider: AIProvider | undefined,
    newModel: string | undefined,
  ) => {
    console.log(`Selected LLM: ${newProvider} - ${newModel}`)
    setProvider(newProvider)
    setModel(newModel)
  }

  const handleChatSubmit = async (input?: string) => {
    if (!componentDetail || !params.codegenId) return

    if (!provider || !model) {
      toast({
        title: "Error",
        description: "Please select a model and provider",
        variant: "default",
      })
      return
    }

    const prompt: Prompt[] = [
      ...(images.length > 0
        ? images.map(image => ({ type: "image" as const, image }))
        : []),
      {
        type: "text" as const,
        text: input || chatInput,
      },
    ]

    // build request parameters
    const requestParams = {
      codegenId: params.codegenId as string,
      prompt,
      component: {
        id: componentDetail._id.toString(),
        name: componentDetail.name,
        code:
          componentDetail.versions.find(
            version => version._id.toString() === activeVersion,
          )?.code || "",
        prompt:
          componentDetail.versions.find(
            version => version._id.toString() === activeVersion,
          )?.prompt || [],
      },
      model,
      provider,
    }

    try {
      setIsSubmitting(true)
      const res = await editMutation.mutateAsync(requestParams)

      const reader = res?.getReader()
      const decoder = new TextDecoder()
      let content = ""

      while (true) {
        const { done, value } = await reader?.read()
        if (done) break
        content += decoder.decode(value)
        setStreamingContent(content)
      }

      const errorMessage = transformTryCatchErrorFromXml(content)
      if (errorMessage) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      setImages([])
      setChatInput("")
      refetch()
    } catch (error) {
      console.error("Failed to edit component:", error)
    } finally {
      setIsSubmitting(false)
      setStreamingContent("")
    }
  }

  const loadingSlot = useMemo(() => {
    if (isSubmitting && !streamingContent) {
      return <CompoderThinkingLoading text="Compoder is thinking..." />
    }
    if (isSubmitting && streamingContent) {
      return (
        <CodingBox
          code={streamingContent}
          className="h-[300px]"
          showMacControls={true}
        />
      )
    }
    return null
  }, [isSubmitting, streamingContent])

  if (shouldShowLoading) {
    return (
      <div className="h-screen">
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-1/6" />
          <Skeleton className="h-8 w-1/4" />
          <div className="flex gap-4">
            <Skeleton className="h-[calc(100vh-12rem)] w-1/2" />
            <Skeleton className="h-[calc(100vh-12rem)] w-1/2" />
            <Skeleton className="h-[calc(100vh-12rem)] w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  const fileNodes = transformComponentArtifactFromXml(
    componentDetail?.versions.find(
      version => version._id.toString() === activeVersion,
    )?.code || "",
  )

  const handleImageRemove = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const onFixError = (error: string) => {
    flushSync(() => {
      setChatInput(error)
    })
    handleChatSubmit(error)
  }

  return (
    <LLMSelectorProvider onChange={handleLLMChange}>
      <div className="h-screen relative">
        <AppHeader
          showSidebarTrigger={false}
          breadcrumbs={[
            { label: "Codegen", href: "/main/codegen" },
            {
              label: "Codegen Detail",
              href: `/main/codegen/${params.codegenId}`,
            },
            { label: componentDetail?.name || "Component Detail" },
          ]}
        />
        <div className="h-[calc(100%-200px)]">
          <ComponentCodeVersionsContainer
            versions={
              componentDetail?.versions.map(version => ({
                id: version._id.toString(),
                prompt: version.prompt,
              })) || []
            }
            activeVersion={activeVersion.toString()}
            onVersionChange={version => setActiveVersion(version)}
          >
            <div className="h-[calc(100%-60px)]">
              <CodeIDE
                data={fileNodes.files}
                onSave={async (files: FileNode[]) => {
                  if (!componentDetail || !activeVersion) return
                  try {
                    const code = transformFileNodeToXml(
                      files,
                      componentDetail.name,
                    )
                    await saveMutation.mutateAsync({
                      id: componentDetail._id.toString(),
                      versionId: activeVersion,
                      code,
                    })
                    toast({
                      title: "Success",
                      description: "Component code saved successfully",
                    })
                  } catch (error) {
                    console.error("Failed to save component code:", error)
                    toast({
                      title: "Error",
                      description: "Failed to save component code",
                      variant: "destructive",
                    })
                  }
                }}
                codeRenderer={
                  <CodeRenderer
                    onFixError={onFixError}
                    codeRendererUrl={componentDetail?.codeRendererUrl!}
                  />
                }
              />
            </div>
          </ComponentCodeVersionsContainer>
        </div>
        {isSubmitting && (
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-10" />
        )}
        <ChatInput
          className="absolute left-1/2 -translate-x-1/2 bottom-6 w-2/3 z-20"
          value={chatInput}
          onChange={setChatInput}
          onSubmit={handleChatSubmit}
          actions={[
            <TooltipProvider key="draw-image">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <TldrawEdit
                      disabled={isSubmitting}
                      onSubmit={imageData => {
                        setImages(prev => [...prev, imageData])
                      }}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Draw An Image</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>,
            <LLMSelectorButton key="llm-selector" />,
          ]}
          images={images}
          onImageRemove={handleImageRemove}
          loading={isSubmitting}
          loadingSlot={loadingSlot}
        />
      </div>
    </LLMSelectorProvider>
  )
}

const CodeRenderer = ({
  onFixError,
  codeRendererUrl,
}: {
  onFixError: (error: string) => void
  codeRendererUrl: string
}) => {
  const { files } = useFile()
  // 将文件内容转换为对象，key是文件名，value是文件内容
  const codes = files.reduce((acc, file) => {
    if (file.content) {
      acc[file.name] = file.content
    }
    if (file.children) {
      file.children.forEach(child => {
        if (child.content) {
          acc[child.name] = child.content
        }
      })
    }
    return acc
  }, {} as Record<string, string>)
  const entryFile = files.find(file => file.isEntryFile)?.name || "App.tsx"

  return (
    <CodeRendererComponent
      codeRendererServer={codeRendererUrl}
      onFixError={onFixError}
      codes={codes}
      entryFile={entryFile}
      hideControls={false}
    />
  )
}
