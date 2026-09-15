// components/LocationDisclosureModal.jsx

import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';

export default function LocationDisclosureModal({
    visible,
    onContinue,
    onDecline,
}) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDecline}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>

                    <Text style={styles.title}>
                        Location Access Required
                    </Text>

                    <Text style={styles.body}>
                        HomeTown-OnTrack collects and uses your location data
                        to verify employee attendance and support authorized
                        field activities.
                    </Text>

                    <Text style={styles.body}>
                        Your location may be collected in the background,
                        including when the app is closed or not in use, after
                        you start attendance or a field activity.
                    </Text>

                    <Text style={styles.body}>
                        This location data is used for employee attendance
                        verification and authorized field activity tracking.
                    </Text>

                    <Text style={styles.note}>
                        You can change your location permission at any time
                        from your device Settings.
                    </Text>

                    <View style={styles.row}>

                        <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={onDecline}
                        >
                            <Text style={styles.declineText}>
                                Not Now
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.continueBtn}
                            onPress={onContinue}
                        >
                            <Text style={styles.continueText}>
                                Agree & Continue
                            </Text>
                        </TouchableOpacity>

                    </View>

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 24,
    },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },

    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 14,
        color: '#222',
    },

    body: {
        fontSize: 14,
        color: '#333',
        marginBottom: 12,
        lineHeight: 21,
    },

    note: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
        marginBottom: 8,
        lineHeight: 18,
    },

    row: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 10,
        gap: 12,
    },

    declineBtn: {
        paddingVertical: 11,
        paddingHorizontal: 14,
    },

    declineText: {
        color: '#777',
        fontWeight: '600',
    },

    continueBtn: {
        backgroundColor: '#D96A17',
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 8,
    },

    continueText: {
        color: '#fff',
        fontWeight: '700',
    },
});