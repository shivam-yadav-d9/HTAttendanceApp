import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

class DeliveryService {

    // =========================================================
    // GET LOGGED-IN DELIVERY AGENT
    // =========================================================
    async getCurrentUser() {
        const userData = await AsyncStorage.getItem('userData');

        if (!userData) {
            throw new Error('User is not logged in');
        }

        const user = JSON.parse(userData);

        return user;
    }

    // =========================================================
    // GET DELIVERY AGENT ID + SITE ID
    // =========================================================
    async getDeliveryAgentInfo() {
        const user = await this.getCurrentUser();

        const agentId = user._id;
        const siteId = user.siteId;

        if (!agentId) {
            throw new Error('Delivery Agent ID not found');
        }

        if (!siteId) {
            throw new Error('Site ID not found');
        }

        return {
            agentId,
            siteId,
            user,
        };
    }

    // =========================================================
    // 1. GET DELIVERY TASKS
    //
    // GET /api/tickets
    //
    // We get tickets for the agent's site and then filter
    // assignedToDeliveryId on the mobile side.
    // =========================================================
    async getMyDeliveries() {
        try {
            const { agentId, siteId } =
                await this.getDeliveryAgentInfo();

            const response = await api.get(
                `/tickets?siteId=${encodeURIComponent(
                    siteId
                )}&limit=100000`
            );

            const tickets = response?.data?.tickets || [];

            const myDeliveries = tickets.filter(
                (ticket) =>
                    String(ticket.assignedToDeliveryId || '') ===
                    String(agentId)
            );

            console.log(
                '[DeliveryService] Agent ID:',
                agentId
            );

            console.log(
                '[DeliveryService] Site ID:',
                siteId
            );

            console.log(
                '[DeliveryService] Total site tickets:',
                tickets.length
            );

            console.log(
                '[DeliveryService] My deliveries:',
                myDeliveries.length
            );

            return {
                success: true,
                agentId,
                siteId,
                tickets: myDeliveries,
                total: myDeliveries.length,
            };

        } catch (error) {
            console.error(
                '[DeliveryService] getMyDeliveries error:',
                error
            );

            throw new Error(
                error.message ||
                'Unable to fetch delivery tasks'
            );
        }
    }

    // =========================================================
    // 2. GET ONE DELIVERY TASK
    //
    // GET /api/tickets/:id
    // =========================================================
    async getDeliveryById(ticketId) {
        try {
            if (!ticketId) {
                throw new Error('Ticket ID is required');
            }

            const response = await api.get(
                `/tickets/${ticketId}`
            );

            return response?.data || null;

        } catch (error) {
            console.error(
                '[DeliveryService] getDeliveryById error:',
                error
            );

            throw new Error(
                error.message ||
                'Unable to fetch delivery details'
            );
        }
    }

    // =========================================================
    // 3. UPDATE DELIVERY
    //
    // PUT /api/tickets/:id
    //
    // Used for normal JSON update.
    // =========================================================
    async updateDelivery(ticketId, deliveryData) {
        try {
            if (!ticketId) {
                throw new Error('Ticket ID is required');
            }

            const response = await api.put(
                `/tickets/${ticketId}`,
                deliveryData
            );

            return response;

        } catch (error) {
            console.error(
                '[DeliveryService] updateDelivery error:',
                error
            );

            throw new Error(
                error.message ||
                'Unable to update delivery'
            );
        }
    }

    // =========================================================
    // 3B. UPDATE DELIVERY WITH PROOF IMAGES
    //
    // PUT /api/tickets/:id
    //
    // Uses FormData.
    // =========================================================
    async updateDeliveryWithProof({
        ticketId,
        status,
        message,
        comment,
        commentedBy,
        commentedById,
        isDeliveryDone,
        failureReason,
        images = [],
    }) {
        try {
            if (!ticketId) {
                throw new Error('Ticket ID is required');
            }

            const formData = new FormData();

            // Status
            if (
                status !== undefined &&
                status !== null
            ) {
                formData.append(
                    'status',
                    String(status)
                );
            }

            // Message
            if (
                message !== undefined &&
                message !== null
            ) {
                formData.append(
                    'message',
                    String(message)
                );
            }

            // Comment
            if (
                comment !== undefined &&
                comment !== null
            ) {
                formData.append(
                    'comment',
                    String(comment)
                );
            }

            // Who commented
            if (
                commentedBy !== undefined &&
                commentedBy !== null
            ) {
                formData.append(
                    'commentedBy',
                    String(commentedBy)
                );
            }

            // Delivery agent ID
            if (
                commentedById !== undefined &&
                commentedById !== null
            ) {
                formData.append(
                    'commentedById',
                    String(commentedById)
                );
            }

            // Delivery completed flag
            if (isDeliveryDone !== undefined) {
                formData.append(
                    'isDeliveryDone',
                    String(Boolean(isDeliveryDone))
                );
            }

            // Failure reason
            if (
                failureReason !== undefined &&
                failureReason !== null
            ) {
                formData.append(
                    'failureReason',
                    String(failureReason)
                );
            }

            // =================================================
            // ADD PROOF IMAGES
            // =================================================
            images.forEach((image, index) => {

                if (!image) {
                    return;
                }

                const uri =
                    typeof image === 'string'
                        ? image
                        : image.uri;

                if (!uri) {
                    return;
                }

                const fileName =
                    typeof image === 'object' &&
                        image.fileName
                        ? image.fileName
                        : `delivery-proof-${Date.now()}-${index}.jpg`;

                const mimeType =
                    typeof image === 'object' &&
                        image.mimeType
                        ? image.mimeType
                        : 'image/jpeg';

                formData.append(
                    'attachments',
                    {
                        uri,
                        name: fileName,
                        type: mimeType,
                    }
                );
            });

            console.log(
                '[DeliveryService] Updating delivery:',
                ticketId
            );

            console.log(
                '[DeliveryService] Status:',
                status
            );

            console.log(
                '[DeliveryService] Proof images:',
                images.length
            );

            const response =
                await api.putFormData(
                    `/tickets/${ticketId}`,
                    formData
                );

            return response;

        } catch (error) {
            console.error(
                '[DeliveryService] updateDeliveryWithProof error:',
                error
            );

            throw new Error(
                error.message ||
                'Unable to update delivery with proof'
            );
        }
    }

    // =========================================================
    // 4. SEND CUSTOMER OTP
    //
    // POST /api/tickets/otp-send
    // =========================================================
    async sendCustomerOtp(customerMobile) {
        try {
            if (!customerMobile) {
                throw new Error(
                    'Customer mobile number is required'
                );
            }

            const response = await api.post(
                '/tickets/otp-send',
                {
                    customerMobile: String(
                        customerMobile
                    ),
                }
            );

            return response;

        } catch (error) {
            console.error(
                '[DeliveryService] sendCustomerOtp error:',
                error
            );

            throw new Error(
                error.message ||
                'Unable to send OTP'
            );
        }
    }

    // =========================================================
    // 5. VERIFY CUSTOMER OTP
    //
    // POST /api/tickets/otp-verify
    // =========================================================
    async verifyCustomerOtp(
        customerMobile,
        otp
    ) {
        try {
            if (!customerMobile) {
                throw new Error(
                    'Customer mobile number is required'
                );
            }

            if (!otp) {
                throw new Error(
                    'OTP is required'
                );
            }

            const response = await api.post(
                '/tickets/otp-verify',
                {
                    customerMobile: String(
                        customerMobile
                    ),
                    otp: String(otp),
                }
            );

            return response;

        } catch (error) {
            console.error(
                '[DeliveryService] verifyCustomerOtp error:',
                error
            );

            throw new Error(
                error.message ||
                'Unable to verify OTP'
            );
        }
    }

    // =========================================================
    // MARK DELIVERY AS DELIVERED
    // =========================================================
    async markDelivered({
        ticketId,
        images = [],
        comment = 'Delivery completed',
    }) {
        const { agentId } =
            await this.getDeliveryAgentInfo();

        return this.updateDeliveryWithProof({
            ticketId,

            status: 'DELIVERY_DONE',

            message: 'Status changed to Delivered',

            comment,

            commentedBy: 'DELIVERY',

            commentedById: agentId,

            isDeliveryDone: true,

            images,
        });
    }

    // =========================================================
    // MARK DELIVERY AS FAILED
    // =========================================================
    async markDeliveryFailed({
        ticketId,
        failureReason,
        comment,
    }) {
        if (!failureReason) {
            throw new Error(
                'Failure reason is required'
            );
        }

        const { agentId } =
            await this.getDeliveryAgentInfo();

        return this.updateDeliveryWithProof({
            ticketId,

            status: 'CANCELLED',

            message: 'Delivery failed',

            comment:
                comment || failureReason,

            commentedBy: 'DELIVERY',

            commentedById: agentId,

            isDeliveryDone: false,

            failureReason,

            images: [],
        });
    }
}

export default new DeliveryService();