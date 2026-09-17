"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  FaCloudUploadAlt,
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaTrashAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaFileVideo,
  FaFileArchive,
} from "react-icons/fa";
import { Card, CardContent, CardHeader } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { cn } from "../../lib/utils";

type FileStatus = "idle" | "uploading" | "success" | "error";

interface FileItem {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  errorMessage?: string;
}

interface FileUploadProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onDrop"
> {
  onFilesAdded?: (files: File[]) => void;
  onFileRemove?: (id: string) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  files?: FileItem[];
}

export function FileUpload({
  onFilesAdded,
  onFileRemove,
  maxFiles = 5,
  maxSizeMB = 10,
  accept,
  files = [],
  className,
  ...props
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (onFilesAdded) {
          onFilesAdded(droppedFiles);
        }
      }
    },
    [onFilesAdded],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const selectedFiles = Array.from(e.target.files);
        if (onFilesAdded) {
          onFilesAdded(selectedFiles);
        }
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onFilesAdded],
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + "" + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("image/"))
      return <FaFileImage className="text-oklch(0.205 0 0) h-5 w-5 dark:text-oklch(0.922 0 0)" />;
    if (fileType.includes("pdf"))
      return <FaFilePdf className="text-oklch(0.577 0.245 27.325) h-5 w-5 dark:text-oklch(0.704 0.191 22.216)" />;
    if (fileType.includes("video/"))
      return <FaFileVideo className="text-oklch(0.205 0 0) h-5 w-5 dark:text-oklch(0.985 0 0)" />;
    if (fileType.includes("zip") || fileType.includes("archive"))
      return <FaFileArchive className="text-oklch(0.556 0 0) h-5 w-5 dark:text-oklch(0.708 0 0)" />;
    return <FaFileAlt className="text-oklch(0.145 0 0) h-5 w-5 dark:text-oklch(0.985 0 0)" />;
  };

  return (
    <div
      className={cn("mx-auto mt-40 w-full max-w-sm space-y-6", className)}
      {...props}
    >
      <Card
        className={cn(
          "group bg-oklch(1 0 0) border-oklch(0.97 0 0)/40 relative h-auto w-full max-w-sm cursor-pointer overflow-hidden rounded-[36px] px-2 py-2 transition-all duration-200 ease-in-out dark:bg-oklch(0.145 0 0) dark:border-oklch(0.269 0 0)/40",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardHeader className="relative z-10">
          <div className="space-y-2 text-center">
            <h2 className="text-oklch(0.145 0 0) text-2xl font-semibold tracking-tight dark:text-oklch(0.985 0 0)">
              Upload Documents
            </h2>
            <p className="text-oklch(0.556 0 0) text-sm dark:text-oklch(0.708 0 0)">
              Securely upload your files, assets and documentation.
            </p>
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "bg-oklch(0.97 0 0)/60 relative z-10 flex min-h-[300px] flex-col items-center justify-center rounded-4xl border-2 border-dashed text-center backdrop-blur-[2px] transition-colors duration-200 dark:bg-oklch(0.269 0 0)/60",
            isDragging
              ? "scale-[1.01]"
              : "border-oklch(0.556 0 0)/20 hover:bg-oklch(0.97 0 0)/80 dark:border-oklch(0.708 0 0)/20 dark:hover:bg-oklch(0.269 0 0)/80",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,rgba(82,82,91,0.05)_0px,rgba(82,82,91,0.05)_1px,transparent_1px,transparent_10px)]" />
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple={maxFiles > 1}
            accept={accept}
            onChange={handleFileSelect}
          />
          <div className="bg-oklch(0.205 0 0)/10 text-oklch(0.205 0 0) group-hover:bg-oklch(0.205 0 0)/20 mt-6 mb-6 flex h-16 w-16 items-center justify-center rounded-full transition-colors dark:bg-oklch(0.922 0 0)/10 dark:text-oklch(0.922 0 0) dark:group-hover:bg-oklch(0.922 0 0)/20">
            <FaCloudUploadAlt className="h-8 w-8" />
          </div>
          <h3 className="text-oklch(0.145 0 0) mb-2 text-xl font-semibold dark:text-oklch(0.985 0 0)">
            Click to upload{""}
            <span className="text-oklch(0.556 0 0) font-normal dark:text-oklch(0.708 0 0)">
              or drag and drop
            </span>
          </h3>
          <p className="text-oklch(0.556 0 0) mb-6 text-sm dark:text-oklch(0.708 0 0)">
            SVG, PNG, JPG, GIF or PDF (max. {maxSizeMB}MB)
          </p>
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-none mb-6"
          >
            Browse Files
          </Button>
        </CardContent>

        {files.length > 0 && (
          <div className="px-2">
            <div className="flex items-center justify-between">
              <h4 className="text-oklch(0.145 0 0) text-sm font-medium dark:text-oklch(0.985 0 0)">
                Uploaded Files
              </h4>
              <span className="text-oklch(0.556 0 0) text-xs font-medium dark:text-oklch(0.708 0 0)">
                {files.length} / {maxFiles}
              </span>
            </div>
            <div className="grid gap-3">
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="group text-oklch(0.145 0 0) relative flex items-center gap-4 overflow-hidden rounded-none py-2 dark:text-oklch(0.985 0 0)"
                >
                  {fileItem.status === "uploading" && (
                    <div className="bg-oklch(0.97 0 0) absolute bottom-0 left-0 h-1 w-full dark:bg-oklch(0.269 0 0)">
                      <div
                        className="bg-oklch(0.205 0 0) h-full transition-all duration-300 ease-in-out dark:bg-oklch(0.922 0 0)"
                        style={{ width: `${fileItem.progress}%` }}
                      />
                    </div>
                  )}

                  <div className="bg-oklch(0.97 0 0) flex-shrink-0 rounded-lg p-3 dark:bg-oklch(0.269 0 0)">
                    {getFileIcon(fileItem.file.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-oklch(0.145 0 0) truncate pr-4 text-sm font-medium dark:text-oklch(0.985 0 0)">
                        {fileItem.file.name}
                      </p>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {fileItem.status === "success" && (
                          <Badge
                            variant="secondary"
                            className="bg-oklch(0.205 0 0)/10 text-oklch(0.205 0 0) hover:bg-oklch(0.205 0 0)/20 gap-1 border-transparent dark:bg-oklch(0.922 0 0)/10 dark:text-oklch(0.922 0 0) dark:hover:bg-oklch(0.922 0 0)/20"
                          >
                            <FaCheckCircle className="h-3 w-3" /> Done
                          </Badge>
                        )}
                        {fileItem.status === "error" && (
                          <Badge variant="destructive" className="gap-1">
                            <FaExclamationCircle className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                        {fileItem.status === "uploading" && (
                          <span className="text-oklch(0.556 0 0) text-xs font-medium dark:text-oklch(0.708 0 0)">
                            {Math.round(fileItem.progress)}%
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFileRemove) onFileRemove(fileItem.id);
                          }}
                          className="text-oklch(0.556 0 0) hover:bg-oklch(0.577 0.245 27.325)/10 hover:text-oklch(0.577 0.245 27.325) h-8 w-8 dark:text-oklch(0.708 0 0) dark:hover:bg-oklch(0.704 0.191 22.216)/10 dark:hover:text-oklch(0.704 0.191 22.216)"
                        >
                          <FaTrashAlt className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove file</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-oklch(0.556 0 0) flex items-center gap-2 text-xs dark:text-oklch(0.708 0 0)">
                      <span>{formatFileSize(fileItem.file.size)}</span>
                      {fileItem.errorMessage && (
                        <>
                          <span>•</span>
                          <span className="text-oklch(0.577 0.245 27.325) truncate dark:text-oklch(0.704 0.191 22.216)">
                            {fileItem.errorMessage}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
