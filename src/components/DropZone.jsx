import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

const DropZone = ({ onFileAccepted }) => {
    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) {
            onFileAccepted(acceptedFiles[0]);
        }
    }, [onFileAccepted]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp']
        },
        multiple: false
    });

    return (
        <motion.div
            {...getRootProps()}
            whileHover={{ scale: 1.02, borderColor: 'rgba(79, 70, 229, 0.5)', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            whileTap={{ scale: 0.98 }}
            className={`
                dropzone cursor-pointer relative overflow-hidden group 
                ${isDragActive ? 'active scale-105 border-indigo-500 ring-4 ring-indigo-500/10' : ''}
                flex flex-col items-center justify-center
            `}
        >
            <input {...getInputProps()} />

            <div className="relative z-10 flex flex-col items-center gap-6">
                <motion.div
                    className={`
                        p-6 rounded-3xl transition-all duration-500
                        ${isDragActive ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/30' : 'bg-indigo-50 text-indigo-500 shadow-sm group-hover:shadow-indigo-500/20 group-hover:bg-white'}
                    `}
                    animate={{
                        y: isDragActive ? -10 : 0,
                        rotate: isDragActive ? 180 : 0
                    }}
                >
                    {isDragActive ? (
                        <FileText size={48} strokeWidth={1.5} />
                    ) : (
                        <Upload size={48} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-300" />
                    )}
                </motion.div>

                <div className="text-center space-y-2">
                    <h3 className={`text-2xl font-bold transition-colors ${isDragActive ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {isDragActive ? 'Drop it here!' : 'Upload PDF or Image'}
                    </h3>
                    <p className="text-gray-500 text-sm font-medium">
                        Drag & drop or <span className="text-indigo-600 underline underline-offset-2">click to browse</span>
                    </p>
                </div>
            </div>

            {/* Premium Background Effects */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-pink-500/5"
                opacity={0}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
            />
        </motion.div>
    );
};

export default DropZone;
