import { FastifyReply, FastifyRequest } from "fastify";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { isMultipartRequest, extractMultipartFields } from "@common/utils/multipart.util";

export class MediaController {
    private r2ClientService: R2ClientService;

    constructor() {
        this.r2ClientService = new R2ClientService();
    }

    /**
     * Upload images to dynamic folders based on type
     */
    async uploadImages(req: FastifyRequest, reply: FastifyReply) {
        try {
            const contentType = (req.headers['content-type'] || '') as string;
            
            if (!isMultipartRequest(contentType)) {
                return reply.status(400).send({ 
                    status: "error", 
                    error: "Content-Type must be multipart/form-data" 
                });
            }

            const body = req.body as Record<string, any>;
            
            // Extract the 'type' field to determine the folder
            const fields = extractMultipartFields<{ type?: string }>(body);
            const folder = fields.type ? `uploads/${fields.type.toLowerCase().trim()}` : "uploads/general";

            // Extract images (supporting both single and multiple files)
            const imagesRaw = body?.images;
            if (!imagesRaw) {
                return reply.status(400).send({ 
                    status: "error", 
                    error: "No images provided. Please use the 'images' field." 
                });
            }

            const images = Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
            const uploadResults = [];

            for (const image of images) {
                // Ensure it's a file object and not a plain field
                if (image && typeof image !== 'string' && typeof image.toBuffer === 'function') {
                    const buffer: Buffer = await image.toBuffer();
                    const result = await this.r2ClientService.uploadFileToR2(
                        buffer,
                        image.filename || 'image',
                        image.mimetype || 'application/octet-stream',
                        folder
                    );
                    uploadResults.push(result);
                }
            }

            if (uploadResults.length === 0) {
                return reply.status(400).send({ 
                    status: "error", 
                    error: "No valid images were uploaded." 
                });
            }

            return reply.send({ 
                status: "success", 
                message: `Successfully uploaded ${uploadResults.length} image(s) to ${folder}`,
                data: uploadResults 
            });

        } catch (error: unknown) {
            const err = error as any;
            console.error("[MediaController] Upload error:", {
                message: err.message,
                code: err.code,
                statusCode: err.statusCode,
                stack: err.stack
            });
            
            const statusCode = err.statusCode || 500;
            const message = err.code === 'FST_ERR_MULTIPART_FILE_SIZE_LIMIT' 
                ? "One or more files exceed the size limit." 
                : "Image upload failed: " + err.message;

            return reply.status(statusCode).send({ 
                status: "error", 
                error: message
            });
        }
    }
}
